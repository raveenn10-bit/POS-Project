create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  name text not null,
  phone text not null,
  email text not null,
  status text not null default 'trial' check (status in ('trial','active','expired')),
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  paid_until timestamptz,
  last_order_id text,
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  device_id text not null,
  amount numeric not null,
  currency text not null default 'LKR',
  status text not null default 'created',
  payment_id text,
  created_at timestamptz not null default now()
);
alter table public.licenses enable row level security;
alter table public.payments enable row level security;
-- API routes use the Supabase service-role key; never expose it in the browser.
