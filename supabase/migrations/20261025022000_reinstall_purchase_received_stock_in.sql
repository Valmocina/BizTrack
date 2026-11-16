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
