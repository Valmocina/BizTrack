alter table public.inventory_transactions
  add column if not exists is_archived boolean not null default false;

drop policy if exists "tx_update" on public.inventory_transactions;
create policy "tx_update"
  on public.inventory_transactions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
