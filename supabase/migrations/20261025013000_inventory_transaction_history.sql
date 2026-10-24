alter table public.inventory_transactions
  add column if not exists previous_stock integer,
  add column if not exists new_stock integer;

create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
  target_stock integer;
  prior_update_flag text;
begin
  select stock
  into current_stock
  from public.products
  where id = new.product_id
  for update;

  if not found then
    raise exception 'Product % does not exist', new.product_id;
  end if;

  if new.reference = 'PRODUCT_UPDATE' and new.new_stock is not null then
    target_stock := new.new_stock;
    new.previous_stock := coalesce(new.previous_stock, current_stock);
  else
    new.previous_stock := current_stock;
    target_stock := case new.type
      when 'IN' then current_stock + new.quantity
      when 'OUT' then current_stock - new.quantity
      else new.quantity
    end;
  end if;

  if target_stock < 0 then
    raise exception 'Insufficient stock for product %: available %, requested %',
      new.product_id,
      current_stock,
      new.quantity;
  end if;

  new.new_stock := target_stock;

  if current_stock is distinct from target_stock then
    prior_update_flag := current_setting('biztrack.inventory_transaction_update', true);
    perform set_config('biztrack.inventory_transaction_update', 'true', true);
    update public.products
    set stock = target_stock
    where id = new.product_id;
    perform set_config(
      'biztrack.inventory_transaction_update',
      coalesce(prior_update_flag, 'false'),
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_inventory_transaction on public.inventory_transactions;
create trigger on_inventory_transaction
  before insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

do $$
declare
  legacy_trigger record;
  legacy_function regprocedure := to_regprocedure(
    'public.track_product_stock_change()'
  );
begin
  if legacy_function is not null then
    for legacy_trigger in
      select tgname
      from pg_trigger
      where tgrelid = 'public.products'::regclass
        and not tgisinternal
        and tgfoid = legacy_function
    loop
      execute format(
        'drop trigger %I on public.products',
        legacy_trigger.tgname
      );
    end loop;

    execute 'drop function public.track_product_stock_change()';
  end if;
end;
$$;

create or replace function public.record_product_stock_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.stock is distinct from new.stock
    and current_setting('biztrack.inventory_transaction_update', true) is distinct from 'true'
  then
    insert into public.inventory_transactions (
      product_id,
      type,
      quantity,
      reference,
      remarks,
      created_by,
      previous_stock,
      new_stock
    )
    values (
      new.id,
      'ADJUST',
      abs(new.stock - old.stock),
      'PRODUCT_UPDATE',
      'Stock correction',
      auth.uid(),
      old.stock,
      new.stock
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_product_stock_adjusted on public.products;
create trigger on_product_stock_adjusted
  after update of stock on public.products
  for each row execute function public.record_product_stock_adjustment();

create or replace function public.record_order_stock_out()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    insert into public.inventory_transactions (
      product_id,
      type,
      quantity,
      reference,
      remarks,
      created_by
    )
    values (
      new.product_id,
      'OUT',
      coalesce(new.quantity, 1),
      new.order_number,
      'Customer order',
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_order_stock_out on public.orders;
create trigger on_order_stock_out
  after insert on public.orders
  for each row execute function public.record_order_stock_out();

create or replace function public.record_purchase_received_stock_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Received'
    and old.status is distinct from 'Received'
    and new.product_id is not null
    and not exists (
      select 1
      from public.inventory_transactions
      where reference = new.po_number
        and type = 'IN'
        and remarks = 'Purchase received'
    )
  then
    insert into public.inventory_transactions (
      product_id,
      type,
      quantity,
      reference,
      remarks,
      created_by
    )
    values (
      new.product_id,
      'IN',
      coalesce(new.quantity, 1),
      new.po_number,
      'Purchase received',
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_purchase_received_stock_in on public.purchase_orders;
create trigger on_purchase_received_stock_in
  after update of status on public.purchase_orders
  for each row execute function public.record_purchase_received_stock_in();

create or replace function public.record_cancelled_order_stock_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Cancelled'
    and old.status is distinct from 'Cancelled'
    and new.product_id is not null
    and exists (
      select 1
      from public.inventory_transactions
      where reference = new.order_number
        and type = 'OUT'
        and remarks = 'Customer order'
    )
    and not exists (
      select 1
      from public.inventory_transactions
      where reference = new.order_number
        and type = 'IN'
        and remarks = 'Cancelled order return'
    )
  then
    insert into public.inventory_transactions (
      product_id,
      type,
      quantity,
      reference,
      remarks,
      created_by
    )
    values (
      new.product_id,
      'IN',
      coalesce(new.quantity, 1),
      new.order_number,
      'Cancelled order return',
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_cancelled_order_stock_return on public.orders;
create trigger on_cancelled_order_stock_return
  after update of status on public.orders
  for each row execute function public.record_cancelled_order_stock_return();

drop policy if exists "tx_insert" on public.inventory_transactions;
create policy "tx_insert"
  on public.inventory_transactions
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "po_update" on public.purchase_orders;
create policy "po_update"
  on public.purchase_orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
