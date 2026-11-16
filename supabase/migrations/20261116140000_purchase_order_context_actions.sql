create table if not exists public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles (id) on delete set null default auth.uid(),
  received_by_name text not null default 'Unknown staff',
  notes text
);

create index if not exists purchase_order_receipts_order_idx
  on public.purchase_order_receipts (purchase_order_id, received_at desc);

with receipt_rows as (
  select
    purchase_order.id as purchase_order_id,
    tx.quantity,
    greatest(
      coalesce(purchase_order.quantity, 0)
        - sum(tx.quantity) over (
          partition by purchase_order.id
          order by tx.created_at, tx.id
        ),
      0
    ) as remaining_quantity,
    tx.created_at as received_at,
    tx.created_by as received_by,
    coalesce(nullif(profile.full_name, ''), profile.email, 'Unknown staff')
      as received_by_name
  from public.purchase_orders as purchase_order
  join public.inventory_transactions as tx
    on tx.reference = purchase_order.po_number
    and tx.type = 'IN'
    and tx.remarks = 'Purchase received'
  left join public.profiles as profile
    on profile.id = tx.created_by
)
insert into public.purchase_order_receipts (
  purchase_order_id,
  quantity,
  remaining_quantity,
  received_at,
  received_by,
  received_by_name
)
select
  purchase_order_id,
  quantity,
  remaining_quantity,
  received_at,
  received_by,
  received_by_name
from receipt_rows
where not exists (
  select 1
  from public.purchase_order_receipts as existing_receipt
  where existing_receipt.purchase_order_id = receipt_rows.purchase_order_id
    and existing_receipt.quantity = receipt_rows.quantity
    and existing_receipt.remaining_quantity = receipt_rows.remaining_quantity
    and existing_receipt.received_at = receipt_rows.received_at
);

update public.purchase_orders
set status = case
  when received_quantity >= coalesce(quantity, 0) then 'Received'
  else 'Partially Received'
end
where received_quantity > 0
  and status in ('In transit', 'Partially Received', 'Received');

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
      or purchase_order.status not in (
        'Pending', 'Pending Approval', 'Approved', 'In transit'
      )
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

create or replace function public.update_purchase_order(
  target_purchase_order uuid,
  new_quantity integer,
  new_expected_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  purchase_order public.purchase_orders%rowtype;
  updated_amount numeric;
begin
  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role is distinct from 'admin' then
    raise exception 'Only administrators can edit purchase orders.';
  end if;

  select *
  into purchase_order
  from public.purchase_orders
  where id = target_purchase_order
  for update;

  if not found then
    raise exception 'Purchase order % does not exist.', target_purchase_order;
  end if;

  if purchase_order.is_archived
    or purchase_order.status not in ('Pending', 'Pending Approval', 'Approved')
    or purchase_order.received_quantity > 0
  then
    raise exception 'This purchase order can no longer be edited.';
  end if;

  if new_quantity is null or new_quantity < 1
    or new_quantity < purchase_order.received_quantity
  then
    raise exception 'Order quantity must be positive and cannot be less than the quantity received.';
  end if;

  updated_amount := round(
    (purchase_order.amount / greatest(coalesce(purchase_order.quantity, 1), 1))
      * new_quantity,
    2
  );

  update public.purchase_orders
  set quantity = new_quantity,
      amount = updated_amount,
      status = case
        when purchase_order.status = 'Pending Approval'
          and updated_amount <= 10000 then 'Pending'
        when purchase_order.status = 'Pending'
          and updated_amount > 10000 then 'Approved'
        else purchase_order.status
      end,
      expected_date = new_expected_date
  where id = target_purchase_order;
end;
$$;

drop function if exists public.record_purchase_receipt(uuid, integer);
create or replace function public.record_purchase_receipt(
  target_purchase_order uuid,
  received_now integer,
  receipt_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_name text;
  purchase_order public.purchase_orders%rowtype;
  new_received_quantity integer;
begin
  select role, coalesce(nullif(full_name, ''), email, 'Unknown staff')
  into actor_role, actor_name
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

  if purchase_order.status in (
    'Pending Approval', 'Rejected', 'Cancelled', 'Received'
  ) then
    raise exception 'This purchase order is not eligible for receiving stock.';
  end if;

  if purchase_order.status not in ('In transit', 'Partially Received') then
    raise exception 'Mark the purchase order in transit before recording a receipt.';
  end if;

  if purchase_order.amount > 10000
    and purchase_order.status not in (
      'Approved', 'In transit', 'Partially Received'
    )
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
        else 'Partially Received'
      end
  where id = target_purchase_order;

  insert into public.purchase_order_receipts (
    purchase_order_id,
    quantity,
    remaining_quantity,
    received_by,
    received_by_name,
    notes
  )
  values (
    target_purchase_order,
    received_now,
    coalesce(purchase_order.quantity, 0) - new_received_quantity,
    auth.uid(),
    actor_name,
    nullif(trim(receipt_notes), '')
  );

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

revoke all on function public.set_purchase_order_status(uuid, text) from public, anon;
revoke all on function public.update_purchase_order(uuid, integer, date) from public, anon;
revoke all on function public.record_purchase_receipt(uuid, integer, text) from public, anon;
grant execute on function public.set_purchase_order_status(uuid, text) to authenticated;
grant execute on function public.update_purchase_order(uuid, integer, date) to authenticated;
grant execute on function public.record_purchase_receipt(uuid, integer, text) to authenticated;

alter table public.purchase_order_receipts enable row level security;
revoke all on public.purchase_order_receipts from public, anon, authenticated;
grant select on public.purchase_order_receipts to authenticated;

drop policy if exists "purchase_order_receipts_select" on public.purchase_order_receipts;
create policy "purchase_order_receipts_select"
  on public.purchase_order_receipts
  for select to authenticated
  using (true);

drop policy if exists "po_update" on public.purchase_orders;
create policy "po_update" on public.purchase_orders
  for update to authenticated
  using (public.is_admin())
  with check (
    public.is_admin()
    and (not is_archived or status in ('Received', 'Cancelled'))
  );

drop policy if exists "po_admin_write" on public.purchase_orders;
create policy "po_admin_write" on public.purchase_orders
  for all to authenticated
  using (public.is_admin())
  with check (
    public.is_admin()
    and (not is_archived or status in ('Received', 'Cancelled'))
  );
