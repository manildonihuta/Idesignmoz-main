-- ----------------------------------------------------------------------
-- IDesign Moz — domain registration flow
-- domains (registry + price catalog) + domain_orders (orders)
-- ----------------------------------------------------------------------

-- 1. DOMAIN EXTENSIONS (price catalogue) --------------------------------
create table if not exists public.domain_extensions (
  id             uuid primary key default gen_random_uuid(),
  extension      text not null unique,                 -- e.g. '.co.mz'
  registration   numeric not null,                     -- price MT
  renewal        numeric not null,
  ideal_for      text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Seed the price catalogue shown on /domains.
insert into public.domain_extensions (extension, registration, renewal, ideal_for)
values
  ('.co.mz',  2500, 2500, 'Negócios locais'),
  ('.com',    1900, 2200, 'Padrão global'),
  ('.africa', 2800, 2800, 'Feito para África'),
  ('.tech',   2400, 2700, 'Tecnologia'),
  ('.shop',   2100, 2500, 'Lojas online')
on conflict (extension) do nothing;

-- 2. DOMAINS (registry) ------------------------------------------------
create table if not exists public.domains (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                          -- SLD, e.g. 'oseunegocio'
  extension     text not null,                          -- e.g. '.co.mz'
  full_domain   text not null unique,                   -- 'oseunegocio.co.mz'
  status        text not null default 'available'
                check (status in ('available', 'registered', 'reserved')),
  price         numeric,                                -- current price at check time (MT)
  checked_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- 3. DOMAIN ORDERS ------------------------------------------------------
create table if not exists public.domain_orders (
  id            uuid primary key default gen_random_uuid(),
  full_domain   text not null,
  extension     text not null,
  name          text not null,
  email         text not null,
  price         numeric not null,
  status        text not null default 'pending'
                check (status in ('pending', 'paid', 'registered', 'cancelled')),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------
alter table public.domain_extensions enable row level security;
alter table public.domains             enable row level security;
alter table public.domain_orders       enable row level security;

-- Price catalogue is public (whoever visits can see prices).
create policy "anyone can read domain extensions"
  on public.domain_extensions for select
  using (true);

-- Anyone can check availability (insert a lookup record for the registry).
create policy "anyone can insert domain lookup"
  on public.domains for insert
  with check (true);

-- Registry readability: public read for availability display.
create policy "anyone can read domains"
  on public.domains for select
  using (true);

-- Anyone can submit a domain order.
create policy "anyone can submit domain order"
  on public.domain_orders for insert
  with check (true);

-- Only authenticated users can read the orders list.
create policy "authenticated can read domain orders"
  on public.domain_orders for select
  using (auth.role() = 'authenticated');
