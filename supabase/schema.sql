-- ============ 1. NUMBERING SEQUENCES ============
create sequence if not exists public.product_sku_seq start 2;
create sequence if not exists public.order_number_seq start 101;
create sequence if not exists public.po_number_seq start 101;

-- ============ 2. CORE TABLES ============

-- PROFILES (Users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now()
);

-- PRODUCTS
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique default ('PRO-' || lpad(nextval('public.product_sku_seq')::text, 3, '0')),
  name text not null,
  subtitle text,
  category text,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_alert integer not null default 10 check (low_stock_alert >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SUPPLIERS
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  category text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  product_id uuid references public.products (id) on delete set null,
  unit_price numeric(10, 2) default 0
);

-- SUPPLIER PRODUCTS (Junction Table)
create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  unit_price numeric(10, 2) default 0,
  created_at timestamptz not null default now()
);

-- ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique default ('ORD-' || nextval('public.order_number_seq')),
  status text not null default 'Pending',
  total numeric(10, 2) not null default 0,
  customer_name text,
  assigned_to uuid references public.profiles (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  quantity integer default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

-- PURCHASE ORDERS
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique default ('PO-' || nextval('public.po_number_seq')),
  supplier_id uuid references public.suppliers (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  quantity integer default 1 check (quantity > 0),
  amount numeric(10, 2) not null default 0,
  status text not null default 'Pending',
  expected_date date,
  created_at timestamptz not null default now()
);

-- INVENTORY TRANSACTIONS
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null check (type in ('IN', 'OUT', 'ADJUST')),
  quantity integer not null check (quantity >= 0),
  reference text,
  remarks text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('low_stock', 'order', 'purchase_order', 'deadline')),
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ 3. HELPER FUNCTIONS & TRIGGERS ============

-- Admin Check Helper
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- New User Profile Sync Function
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data ->> 'full_name', 
    coalesce(new.raw_app_meta_data ->> 'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end; 
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created 
  after insert on auth.users 
  for each row execute function public.handle_new_user();

-- Automatic Inventory Stock Adjustment Trigger
create or replace function public.apply_inventory_transaction()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.products
  set stock = case new.type
    when 'IN' then stock + new.quantity
    when 'OUT' then greatest(stock - new.quantity, 0)
    else new.quantity
  end
  where id = new.product_id;
  return new;
end; 
$$;

drop trigger if exists on_inventory_transaction on public.inventory_transactions;
create trigger on_inventory_transaction 
  after insert on public.inventory_transactions 
  for each row execute function public.apply_inventory_transaction();

-- Low Stock Notification Trigger
create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock <= new.low_stock_alert and (tg_op = 'INSERT' or new.stock < old.stock) then
    insert into public.notifications (type, title, message) 
    values ('low_stock', 'Low Stock Alert', new.name || ' is below reorder level.');
  end if;
  return new;
end; 
$$;

drop trigger if exists on_product_low_stock on public.products;
create trigger on_product_low_stock 
  after insert or update of stock on public.products 
  for each row execute function public.notify_low_stock();

-- New Order Notification Trigger
create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (type, title, message) 
  values ('order', 'New Order', 'Order #' || new.order_number || ' has been placed.');
  return new;
end; 
$$;

drop trigger if exists on_order_created on public.orders;
create trigger on_order_created 
  after insert on public.orders 
  for each row execute function public.notify_new_order();

-- ============ 4. ROW LEVEL SECURITY (RLS) ============

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.orders enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.notifications enable row level security;

-- Profiles Policy
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

-- Products Policy
drop policy if exists "products_select" on public.products;
drop policy if exists "products_admin_write" on public.products;
create policy "products_select" on public.products for select to authenticated using (true);
create policy "products_admin_write" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Suppliers Policy
drop policy if exists "suppliers_select" on public.suppliers;
drop policy if exists "suppliers_admin_write" on public.suppliers;
create policy "suppliers_select" on public.suppliers for select to authenticated using (true);
create policy "suppliers_admin_write" on public.suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Supplier Products Policy
drop policy if exists "supplier_products_select" on public.supplier_products;
drop policy if exists "supplier_products_admin_write" on public.supplier_products;
create policy "supplier_products_select" on public.supplier_products for select to authenticated using (true);
create policy "supplier_products_admin_write" on public.supplier_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders Policy
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_admin_write" on public.orders;
create policy "orders_select" on public.orders for select to authenticated using (true);
create policy "orders_admin_write" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Purchase Orders Policy
drop policy if exists "po_select" on public.purchase_orders;
drop policy if exists "po_update" on public.purchase_orders;
drop policy if exists "po_admin_write" on public.purchase_orders;
create policy "po_select" on public.purchase_orders for select to authenticated using (true);
create policy "po_update" on public.purchase_orders for update to authenticated using (true) with check (true);
create policy "po_admin_write" on public.purchase_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Inventory Transactions Policy
drop policy if exists "tx_select" on public.inventory_transactions;
drop policy if exists "tx_insert" on public.inventory_transactions;
create policy "tx_select" on public.inventory_transactions for select to authenticated using (true);
create policy "tx_insert" on public.inventory_transactions for insert to authenticated with check (true);

-- Notifications Policy
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_select" on public.notifications for select to authenticated using (true);
create policy "notifications_update" on public.notifications for update to authenticated using (true) with check (true);
create policy "notifications_delete" on public.notifications for delete to authenticated using (true);

-- ============ 5. SEED INITIAL SAMPLE PRODUCT ============
insert into public.products (sku, name, category, description, price, stock, low_stock_alert)
values ('PRO-001', 'Sample Product', 'General', 'Replace or delete this sample product.', 9.99, 25, 10)
on conflict (sku) do nothing;