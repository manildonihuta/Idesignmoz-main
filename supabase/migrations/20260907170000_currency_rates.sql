-- Currency layer.
--
-- 1. FX rates: MZN per 1 unit of each supported foreign currency. MZN is the
--    principal; USD / EUR / ZAR are prepared for a future multi-currency
--    storefront. Rates live in `currency_rates`, written only by admins.
-- 2. Standardise / add `currency` columns (ISO codes) on money-bearing tables
--    and widen proposal money columns from integer to numeric(12,2).

-- ----------------------------------------------------------------------
-- FX RATES
-- ----------------------------------------------------------------------
create table if not exists public.currency_rates (
  code       text primary key check (code in ('MZN', 'USD', 'EUR', 'ZAR')),
  rate       numeric(12,4) not null,  -- MZN per 1 unit of `code`
  updated_at timestamptz not null default now()
);

alter table public.currency_rates enable row level security;

-- No anonymous/authenticated read or write: access goes through the admin API
-- (service role bypasses RLS). Public conversion uses defaults seeded here.
create policy "currency_rates no anon read" on public.currency_rates
  for select to anon using (false);
create policy "currency_rates no anon write" on public.currency_rates
  for all to anon using (false) with check (false);

insert into public.currency_rates (code, rate)
values
  ('MZN', 1.0000),
  ('USD', 64.0000),
  ('EUR', 69.5000),
  ('ZAR', 3.5500)
on conflict (code) do update set rate = excluded.rate, updated_at = now();
