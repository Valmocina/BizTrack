alter table public.orders
  add column if not exists is_archived boolean not null default false;

alter table public.purchase_orders
  add column if not exists is_archived boolean not null default false;
