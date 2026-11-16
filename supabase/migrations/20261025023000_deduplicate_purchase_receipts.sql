do $$
declare
  purchase_trigger record;
  duplicate_receipt record;
  current_stock integer;
begin
  for purchase_trigger in
    select trigger_row.tgname
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.purchase_orders'::regclass
      and not trigger_row.tgisinternal
      and (trigger_row.tgtype & 16) = 16
      and trigger_row.tgname <> 'on_purchase_received_stock_in'
      and (
        pg_get_functiondef(trigger_row.tgfoid) ilike '%inventory_transactions%'
        or pg_get_functiondef(trigger_row.tgfoid) ilike '%products%'
        or pg_get_functiondef(trigger_row.tgfoid) ilike '%stock%'
      )
  loop
    raise notice 'Removing duplicate purchase stock trigger: %',
      purchase_trigger.tgname;
    execute format(
      'drop trigger %I on public.purchase_orders',
      purchase_trigger.tgname
    );
  end loop;

  for duplicate_receipt in
    select
      receipt.product_id,
      sum(receipt.quantity)::integer as excess_quantity
    from (
      select
        transaction_row.product_id,
        transaction_row.quantity,
        row_number() over (
          partition by transaction_row.reference
          order by
            (transaction_row.remarks = 'Purchase received') desc,
            transaction_row.created_at,
            transaction_row.id
        ) as duplicate_number
      from public.inventory_transactions as transaction_row
      join public.purchase_orders as purchase_order
        on purchase_order.po_number = transaction_row.reference
      where transaction_row.type = 'IN'
        and transaction_row.is_archived = false
        and transaction_row.product_id = purchase_order.product_id
    ) as receipt
    where receipt.duplicate_number > 1
    group by receipt.product_id
  loop
    select stock
    into current_stock
    from public.products
    where id = duplicate_receipt.product_id
    for update;

    if current_stock is null
      or current_stock < duplicate_receipt.excess_quantity
    then
      raise exception
        'Cannot automatically reconcile duplicate purchase receipts for product %. Current stock is %, duplicate receipt quantity is %.',
        duplicate_receipt.product_id,
        current_stock,
        duplicate_receipt.excess_quantity;
    end if;

    update public.products
    set stock = stock - duplicate_receipt.excess_quantity
    where id = duplicate_receipt.product_id;
  end loop;

  with ranked_receipts as (
    select
      transaction_row.id,
      row_number() over (
        partition by transaction_row.reference
        order by
          (transaction_row.remarks = 'Purchase received') desc,
          transaction_row.created_at,
          transaction_row.id
      ) as duplicate_number
    from public.inventory_transactions as transaction_row
    join public.purchase_orders as purchase_order
      on purchase_order.po_number = transaction_row.reference
    where transaction_row.type = 'IN'
      and transaction_row.is_archived = false
      and transaction_row.product_id = purchase_order.product_id
  )
  update public.inventory_transactions as transaction_row
  set is_archived = true
  from ranked_receipts
  where transaction_row.id = ranked_receipts.id
    and ranked_receipts.duplicate_number > 1;
end;
$$;

create unique index if not exists one_active_purchase_receipt_per_order
  on public.inventory_transactions (reference)
  where type = 'IN'
    and remarks = 'Purchase received'
    and is_archived = false;

create or replace function public.record_purchase_received_stock_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Received'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from 'Received'
    )
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

drop trigger if exists on_purchase_received_stock_in
  on public.purchase_orders;

create trigger on_purchase_received_stock_in
  after insert or update of status on public.purchase_orders
  for each row
  execute function public.record_purchase_received_stock_in();
