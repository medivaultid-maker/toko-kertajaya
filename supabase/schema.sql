-- Toko Rosyidah: fondasi database online.
-- Jalankan di Supabase SQL Editor pada project baru.
-- Catatan: jangan pernah meletakkan service_role key di browser.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'stock_entry', 'cashier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.intake_status as enum ('pending_price', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique,
  role public.app_role not null default 'cashier',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  name text not null,
  brand text not null default '',
  unit text not null default 'pcs',
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  current_purchase_cost numeric(14,2),
  current_profit_percent numeric(7,3),
  current_selling_price numeric(14,2),
  price_status text not null default 'pending_price' check (price_status in ('pending_price','approved')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, brand)
);

create table if not exists public.purchase_intakes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  purchase_date date not null,
  quantity_received numeric(14,3) not null check (quantity_received > 0),
  quantity_remaining numeric(14,3) not null check (quantity_remaining >= 0),
  purchase_price numeric(14,2) not null check (purchase_price >= 0),
  profit_percent numeric(7,3),
  selling_price numeric(14,2),
  status public.intake_status not null default 'pending_price',
  entered_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (quantity_remaining <= quantity_received),
  check (
    (status = 'pending_price' and profit_percent is null and selling_price is null)
    or
    (status = 'approved' and profit_percent is not null and selling_price is not null)
    or status = 'rejected'
  )
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_role public.app_role not null default 'admin',
  title text not null,
  message text not null,
  related_intake_id uuid references public.purchase_intakes(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  cashier_id uuid references public.profiles(id),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash','qris','transfer','other')),
  amount_paid numeric(14,2) not null check (amount_paid >= 0),
  change_amount numeric(14,2) not null default 0 check (change_amount >= 0),
  status text not null default 'completed' check (status in ('completed','voided')),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  brand_snapshot text not null default '',
  quantity numeric(14,3) not null check (quantity > 0),
  purchase_cost_snapshot numeric(14,2) not null check (purchase_cost_snapshot >= 0),
  selling_price_snapshot numeric(14,2) not null check (selling_price_snapshot >= 0),
  profit_percent_snapshot numeric(7,3) not null check (profit_percent_snapshot >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  gross_profit_snapshot numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists purchase_intakes_status_idx on public.purchase_intakes(status, created_at desc);
create index if not exists notifications_role_unread_idx on public.notifications(recipient_role, is_read, created_at desc);
create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);

-- Enable RLS on all business tables. Policies and secure RPCs are added in the next implementation step.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.purchase_intakes enable row level security;
alter table public.notifications enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.audit_logs enable row level security;

-- No broad public policies are intentionally created here.
-- Until role-based policies and server-side transaction RPCs are added, the browser cannot read/write these tables.
