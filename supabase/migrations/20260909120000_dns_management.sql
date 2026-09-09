-- ----------------------------------------------------------------------
-- IDesign Moz — DNS management
-- dns_zones + dns_records + dns_activity_logs
-- Zone per owned domain; records belong to a zone; every change is logged.
-- ----------------------------------------------------------------------

-- 1. DNS ZONES ---------------------------------------------------------
-- status: pending | active | disabled | error | manual
--   pending -> provider not connected / manual setup required
--   manual  -> configured outside the platform (manual setup completed)
--   active  -> verified with a real provider
-- dnssec: disabled | pending | active | error
create table if not exists public.dns_zones (
  id               uuid primary key default gen_random_uuid(),
  full_domain      text not null unique,
  user_id          uuid,                                -- owner in auth.users (may be null on legacy orders)
  provider         text not null default 'local',       -- local | cloudflare | registrar | cpanel | ...
  provider_zone_id text,
  status           text not null default 'pending'
                   check (status in ('pending', 'active', 'disabled', 'error', 'manual')),
  nameservers      jsonb not null default '{"ns1":"ns1.idesignmoz.com","ns2":"ns2.idesignmoz.com"}'::jsonb,
  dnssec           text not null default 'disabled'
                   check (dnssec in ('disabled', 'pending', 'active', 'error')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists dns_zones_user_idx on public.dns_zones(user_id);

-- 2. DNS RECORDS -------------------------------------------------------
-- type: A | AAAA | CNAME | MX | TXT | NS | SRV | CAA
create table if not exists public.dns_records (
  id           uuid primary key default gen_random_uuid(),
  zone_id      uuid not null references public.dns_zones(id) on delete cascade,
  type         text not null
               check (type in ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA')),
  name         text not null,                           -- '@' | 'www' | 'mail' | ...
  value        text not null,
  ttl          integer not null default 3600,
  priority     integer,                                 -- MX / SRV only
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists dns_records_zone_idx on public.dns_records(zone_id);
create index if not exists dns_records_name_idx on public.dns_records(zone_id, name, type);

-- 3. DNS ACTIVITY LOG --------------------------------------------------
create table if not exists public.dns_activity_logs (
  id          uuid primary key default gen_random_uuid(),
  zone_id     uuid not null references public.dns_zones(id) on delete cascade,
  user_id     uuid,
  action      text not null check (action in (
                'zone_created', 'record_created', 'record_updated', 'record_deleted',
                'nameservers_updated', 'dnssec_enabled', 'dnssec_disabled',
                'template_applied', 'propagation_checked', 'zone_synced'
              )),
  record_type text,
  record_id   uuid,
  old_value   text,
  new_value   text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists dns_activity_zone_idx on public.dns_activity_logs(zone_id, created_at desc);

-- 4. UPDATED_AT TRIGGERS ----------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dns_zones_touch on public.dns_zones;
create trigger dns_zones_touch
  before update on public.dns_zones
  for each row execute function public.touch_updated_at();

drop trigger if exists dns_records_touch on public.dns_records;
create trigger dns_records_touch
  before update on public.dns_records
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------
alter table public.dns_zones         enable row level security;
alter table public.dns_records       enable row level security;
alter table public.dns_activity_logs enable row level security;

-- Owner helper: wrap rls() so the *owner* of the domain (by domain order or
-- registry customer) is the only session role allowed to touch its zone.
create or replace function public.is_dns_zone_owner(zone_user_id uuid, zone_domain text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      zone_user_id = auth.uid()
      or exists (
        select 1 from public.domain_orders o
        where o.full_domain = zone_domain
          and (o.customer_id = auth.uid() or o.email = auth.email())
      )
      or exists (
        select 1 from public.domains d
        where d.full_domain = zone_domain and d.customer_id = auth.uid()
      )
    );
$$;

-- ZONES ----------------------------------------------------------------
create policy "owners can read zones"
  on public.dns_zones for select
  using (is_dns_zone_owner(user_id, full_domain));

create policy "owners can create zones"
  on public.dns_zones for insert
  with check (is_dns_zone_owner(user_id, full_domain));

create policy "owners can update zones"
  on public.dns_zones for update
  using (is_dns_zone_owner(user_id, full_domain));

create policy "owners can delete zones"
  on public.dns_zones for delete
  using (is_dns_zone_owner(user_id, full_domain));

-- RECORDS (ownership through zone) -------------------------------------
create policy "owners can read records"
  on public.dns_records for select
  using (exists (
    select 1 from public.dns_zones z
    where z.id = zone_id and is_dns_zone_owner(z.user_id, z.full_domain)
  ));

create policy "owners can insert records"
  on public.dns_records for insert
  with check (exists (
    select 1 from public.dns_zones z
    where z.id = zone_id and is_dns_zone_owner(z.user_id, z.full_domain)
  ));

create policy "owners can update records"
  on public.dns_records for update
  using (exists (
    select 1 from public.dns_zones z
    where z.id = zone_id and is_dns_zone_owner(z.user_id, z.full_domain)
  ));

create policy "owners can delete records"
  on public.dns_records for delete
  using (exists (
    select 1 from public.dns_zones z
    where z.id = zone_id and is_dns_zone_owner(z.user_id, z.full_domain)
  ));

-- ACTIVITY -------------------------------------------------------------
create policy "owners can read activity"
  on public.dns_activity_logs for select
  using (exists (
    select 1 from public.dns_zones z
    where z.id = zone_id and is_dns_zone_owner(z.user_id, z.full_domain)
  ));

create policy "owners can log activity"
  on public.dns_activity_logs for insert
  with check (exists (
    select 1 from public.dns_zones z
    where z.id = zone_id and is_dns_zone_owner(z.user_id, z.full_domain)
  ));