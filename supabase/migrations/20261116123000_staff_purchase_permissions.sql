alter table public.purchase_orders
  add column if not exists received_quantity integer not null default 0;

update public.purchase_orders
set received_quantity = coalesce(quantity, 0)
where status = 'Received' and received_quantity = 0;

update public.purchase_orders
set status = 'Approved'
where amount > 10000 and status = 'Pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_orders'::regclass
      and conname = 'purchase_orders_received_quantity_check'
  ) then
    alter table public.purchase_orders
      add constraint purchase_orders_received_quantity_check
      check (
        received_quantity >= 0
        and received_quantity <= coalesce(quantity, 0)
      );
  end if;
end;
$$;

drop trigger if exists on_purchase_received_stock_in
  on public.purchase_orders;
drop function if exists public.record_purchase_received_stock_in();
drop index if exists public.one_active_purchase_receipt_per_order;

create index if not exists purchase_receipt_reference_idx
  on public.inventory_transactions (reference)
  where type = 'IN'
    and remarks = 'Purchase received'
    and is_archived = false;

create or replace function public.set_order_status(
  target_order uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  current_status text;
  order_is_archived boolean;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role is null then
    raise exception 'An authenticated profile is required.';
  end if;

  if next_status is null
    or next_status not in (
      'Pending', 'Processing', 'Completed', 'Rejected', 'Cancelled'
    )
  then
    raise exception 'Invalid order status: %', next_status;
  end if;

  if actor_role <> 'admin' and next_status not in ('Pending', 'Processing', 'Completed') then
    raise exception 'Only administrators can reject or cancel orders.';
  end if;

  select status, is_archived
  into current_status, order_is_archived
  from public.orders
  where id = target_order
  for update;

  if not found then
    raise exception 'Order % does not exist.', target_order;
  end if;

  if order_is_archived then
    raise exception 'Archived orders cannot be updated.';
  end if;

  if actor_role <> 'admin'
    and (current_status <> 'Processing' or next_status <> 'Completed')
  then
    raise exception 'Staff can only complete orders that are in progress.';
  end if;

  if actor_role = 'admin'
    and current_status in ('Completed', 'Rejected', 'Cancelled')
    and next_status <> current_status
  then
    raise exception 'Completed, rejected, and cancelled orders cannot be changed.';
  end if;

  update public.orders
  set status = next_status
  where id = target_order;
end;
$$;

create or replace function public.record_cancelled_order_stock_return()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('Cancelled', 'Rejected')
    and old.status not in ('Cancelled', 'Rejected')
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
        and remarks in ('Cancelled order return', 'Rejected order return')
    )
  then
    insert into public.inventory_transactions (
      product_id, type, quantity, reference, remarks, created_by
    )
    values (
      new.product_id,
      'IN',
      coalesce(new.quantity, 1),
      new.order_number,
      case
        when new.status = 'Rejected' then 'Rejected order return'
        else 'Cancelled order return'
      end,
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

create or replace function public.create_purchase_order(
  purchase_supplier_id uuid,
  purchase_product_id uuid,
  purchase_quantity integer,
  purchase_expected_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  item_price numeric;
  order_total numeric;
  initial_status text;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role is null or actor_role not in ('admin', 'employee') then
    raise exception 'An authenticated profile is required.';
  end if;

  if purchase_quantity is null or purchase_quantity < 1 then
    raise exception 'Purchase quantity must be greater than zero.';
  end if;

  select min(unit_price)
  into item_price
  from public.supplier_products
  where supplier_id = purchase_supplier_id
    and product_id = purchase_product_id;

  if item_price is null then
    raise exception 'The selected product is not offered by this supplier.';
  end if;

  order_total := round(item_price * purchase_quantity, 2);

  if order_total > 10000 and actor_role = 'employee' then
    initial_status := 'Pending Approval';
  elsif order_total > 10000 then
    initial_status := 'Approved';
  else
    initial_status := 'Pending';
  end if;

  insert into public.purchase_orders (
    supplier_id,
    product_id,
    quantity,
    received_quantity,
    amount,
    status,
    expected_date
  )
  values (
    purchase_supplier_id,
    purchase_product_id,
    purchase_quantity,
    0,
    order_total,
    initial_status,
    purchase_expected_date
  );

  return initial_status;
end;
$$;

create or replace function public.set_purchase_order_status(
  target_purchase_order uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  purchase_order public.purchase_orders%rowtype;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role is null or actor_role not in ('admin', 'employee') then
    raise exception 'An authenticated profile is required.';
  end if;

  select *
  into purchase_order
  from public.purchase_orders
  where id = target_purchase_order
  for update;

  if not found then
    raise exception 'Purchase order % does not exist.', target_purchase_order;
  end if;

  if purchase_order.is_archived then
    raise exception 'Archived purchase orders cannot be updated.';
  end if;

  if next_status = 'In transit' then
    if purchase_order.status not in ('Pending', 'Approved', 'In transit') then
      raise exception 'This purchase order cannot be marked in transit.';
    end if;

    if purchase_order.amount > 10000
      and purchase_order.status not in ('Approved', 'In transit')
    then
      raise exception 'High-value purchases require admin approval first.';
    end if;
  elsif next_status in ('Approved', 'Rejected') then
    if actor_role <> 'admin'
      or purchase_order.status <> 'Pending Approval'
      or purchase_order.amount <= 10000
    then
      raise exception 'Only administrators can approve or reject pending high-value purchases.';
    end if;
  elsif next_status = 'Cancelled' then
    if actor_role <> 'admin'
      or purchase_order.status in ('Received', 'Rejected', 'Cancelled')
    then
      raise exception 'Only administrators can cancel open purchase orders.';
    end if;
  else
    raise exception 'Invalid purchase order status: %', next_status;
  end if;

  update public.purchase_orders
  set status = next_status
  where id = target_purchase_order;
end;
$$;

create or replace function public.record_purchase_receipt(
  target_purchase_order uuid,
  received_now integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  purchase_order public.purchase_orders%rowtype;
  new_received_quantity integer;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role is null or actor_role not in ('admin', 'employee') then
    raise exception 'An authenticated profile is required.';
  end if;

  select *
  into purchase_order
  from public.purchase_orders
  where id = target_purchase_order
  for update;

  if not found then
    raise exception 'Purchase order % does not exist.', target_purchase_order;
  end if;

  if purchase_order.is_archived then
    raise exception 'Archived purchase orders cannot receive stock.';
  end if;

  if purchase_order.status in ('Pending Approval', 'Rejected', 'Cancelled', 'Received') then
    raise exception 'This purchase order is not eligible for receiving stock.';
  end if;

  if purchase_order.amount > 10000
    and purchase_order.status not in ('Approved', 'In transit')
  then
    raise exception 'High-value purchases require admin approval before receiving stock.';
  end if;

  if purchase_order.product_id is null then
    raise exception 'Link a product before receiving stock.';
  end if;

  if received_now is null or received_now < 1 then
    raise exception 'Received quantity must be greater than zero.';
  end if;

  if received_now > coalesce(purchase_order.quantity, 0) - purchase_order.received_quantity then
    raise exception 'Received quantity exceeds the outstanding purchase quantity.';
  end if;

  new_received_quantity := purchase_order.received_quantity + received_now;

  update public.purchase_orders
  set received_quantity = new_received_quantity,
      status = case
        when new_received_quantity = quantity then 'Received'
        else 'In transit'
      end
  where id = target_purchase_order;

  insert into public.inventory_transactions (
    product_id,
    type,
    quantity,
    reference,
    remarks,
    created_by
  )
  values (
    purchase_order.product_id,
    'IN',
    received_now,
    purchase_order.po_number,
    'Purchase received',
    auth.uid()
  );
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public, anon;
revoke all on function public.create_purchase_order(uuid, uuid, integer, date) from public, anon;
revoke all on function public.set_purchase_order_status(uuid, text) from public, anon;
revoke all on function public.record_purchase_receipt(uuid, integer) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;
grant execute on function public.create_purchase_order(uuid, uuid, integer, date) to authenticated;
grant execute on function public.set_purchase_order_status(uuid, text) to authenticated;
grant execute on function public.record_purchase_receipt(uuid, integer) to authenticated;

drop policy if exists "tx_insert" on public.inventory_transactions;
create policy "tx_insert"
  on public.inventory_transactions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('admin', 'employee')
    )
  );
