-- ----------------------------------------------------------------------
-- IDesign Moz — Cloudflare DNS provider
-- Adds provider_record_id to dns_records (link between the local mirror
-- and the external Cloudflare record) and seeds the dns-cloudflare
-- provider row. Incremental + additive (IF NOT EXISTS / ON CONFLICT).
-- ----------------------------------------------------------------------

-- 1. DNS RECORD MIRROR LINK -------------------------------------------
alter table public.dns_records
  add column if not exists provider_record_id text;

-- Unique (NULLs are allowed to repeat) so upsert with ON CONFLICT
-- (provider_record_id) works for Cloudflare-backed zones.
create unique index if not exists dns_records_provider_record_idx
  on public.dns_records (provider_record_id);

-- 2. SEED dns-cloudflare ----------------------------------------------
-- Mirrors src/lib/providers/registry.ts. Starts inactive until a
-- CLOUDFLARE_API_TOKEN is configured; the health probe and admin
-- activation then flip it to active. Cloudflare assigns its own
-- nameservers, so dns.nameservers is not advertised.
insert into public.providers (slug, name, type, adapter, status, environment, capabilities, is_builtin, sort)
values (
  'dns-cloudflare',
  'Cloudflare DNS',
  'dns',
  'CloudflareDnsProvider',
  'inactive',
  'production',
  '["dns.zones","dns.records","dns.dnssec","dns.propagation"]',
  true,
  21
)
on conflict (slug) do nothing;