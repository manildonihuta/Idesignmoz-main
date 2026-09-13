-- ----------------------------------------------------------------------
-- IDesign Moz — Infrastructure & Provider Integration Layer
-- Central gateway tables for external infrastructure providers (domains,
-- DNS, hosting, email, SSL, CDN, backups). Credentials are stored only
-- as AES-256-GCM ciphertext via the credential vault; nothing here is
-- returned to the frontend as plaintext.
-- Conventions: EN snake_case, text+CHECK statuses (no enums), uuid PKs,
-- touch_updated_at() triggers, service-role-only RLS (no client policies).
-- Incremental + additive: every statement guards with IF NOT EXISTS so it
-- re-runs safely on an already-migrated schema.
-- ----------------------------------------------------------------------

-- 1. PROVIDERS ----------------------------------------------------------
-- Registered infrastructure providers (DB mirror of the built-in adapters
-- plus any future providers managed at runtime).
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  type text not null check (type in ('domain','dns','hosting','email','ssl','cdn','backup','storage')),
  adapter text,
  status text not null default 'unknown' check (status in ('active','inactive','maintenance','degraded','error','unknown')),
  environment text not null default 'production' check (environment in ('production','staging','development')),
  capabilities jsonb not null default '[]',
  api_endpoint text,
  config jsonb,
  is_builtin boolean not null default false,
  sort int not null default 0,
  last_health_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint providers_slug_key unique (slug)
);

drop index if exists providers_slug_idx;
create index providers_slug_idx on public.providers (slug);
drop index if exists providers_status_idx;
create index providers_status_idx on public.providers (status, type);

drop trigger if exists providers_touch on public.providers;
create trigger providers_touch before update on public.providers
  for each row execute function public.touch_updated_at();

-- 2. PROVIDER CREDENTIALS ---------------------------------------------
-- Encrypted credential fields. encrypted_data holds the JSON string of an
-- EncryptedSecret (aes-256-gcm) produced by encryptSecret(). Never select()
-- this column for the frontend.
create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete cascade,
  field text not null,
  encrypted_data text not null,
  status text not null default 'active' check (status in ('active','expired','revoked','rotating')),
  expires_at timestamptz,
  rotated_at timestamptz,
  last_verified_at timestamptz,
  last_verified_ok boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_credentials_provider_field_key unique (provider_id, field)
);

drop index if exists provider_credentials_provider_idx;
create index provider_credentials_provider_idx on public.provider_credentials (provider_id);
drop index if exists provider_credentials_expires_idx;
create index provider_credentials_expires_idx on public.provider_credentials (status, expires_at);

drop trigger if exists provider_credentials_touch on public.provider_credentials;
create trigger provider_credentials_touch before update on public.provider_credentials
  for each row execute function public.touch_updated_at();

-- 3. PROVIDER RESOURCES ------------------------------------------------
-- Mapping between IDesign Moz resources and external provider resources.
create table if not exists public.provider_resources (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete cascade,
  service_type text not null check (service_type in ('domain','dns','hosting','email','ssl','cdn','backup','storage')),
  internal_resource_id uuid not null,
  external_resource_id text,
  external_reference jsonb,
  status text not null default 'active' check (status in ('active','syncing','error','orphaned','removed')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_resources_unique_resource unique (provider_id, service_type, internal_resource_id)
);

drop index if exists provider_resources_provider_idx;
create index provider_resources_provider_idx on public.provider_resources (provider_id, service_type);
drop index if exists provider_resources_sync_idx;
create index provider_resources_sync_idx on public.provider_resources (last_synced_at);

drop trigger if exists provider_resources_touch on public.provider_resources;
create trigger provider_resources_touch before update on public.provider_resources
  for each row execute function public.touch_updated_at();

-- 4. PROVIDER SYNC JOBS ------------------------------------------------
create table if not exists public.provider_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete set null,
  service text not null check (service in ('domain','dns','hosting','email','ssl','cdn','backup')),
  kind text not null default 'manual' check (kind in ('manual','scheduled','event','full','incremental')),
  status text not null default 'pending' check (status in ('pending','running','completed','failed','cancelled')),
  records_processed int not null default 0,
  last_error text,
  retry_count int not null default 0,
  max_retries int not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists provider_sync_jobs_open_idx;
create index provider_sync_jobs_open_idx on public.provider_sync_jobs (status, run_after);
drop index if exists provider_sync_jobs_provider_idx;
create index provider_sync_jobs_provider_idx on public.provider_sync_jobs (provider_id, created_at);

drop trigger if exists provider_sync_jobs_touch on public.provider_sync_jobs;
create trigger provider_sync_jobs_touch before update on public.provider_sync_jobs
  for each row execute function public.touch_updated_at();

-- 5. PROVIDER WEBHOOKS (outbound) --------------------------------------
create table if not exists public.provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete set null,
  service text not null check (service in ('domain','dns','hosting','email','ssl','cdn','backup','payment')),
  name text not null,
  url text not null,
  secret_cipher text,
  events jsonb not null default '[]',
  status text not null default 'active' check (status in ('active','inactive')),
  last_delivered_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists provider_webhooks_provider_idx;
create index provider_webhooks_provider_idx on public.provider_webhooks (provider_id, status);

drop trigger if exists provider_webhooks_touch on public.provider_webhooks;
create trigger provider_webhooks_touch before update on public.provider_webhooks
  for each row execute function public.touch_updated_at();

-- 6. PROVIDER EVENTS (inbound webhook receipts) -------------------------
-- Idempotent processing store: idempotency_key is unique so duplicate
-- deliveries are detected and dropped.
create table if not exists public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete set null,
  source text not null,
  event text not null,
  payload jsonb,
  idempotency_key text not null,
  signature_verified boolean not null default false,
  status text not null default 'queued' check (status in ('queued','processing','processed','failed','ignored','rejected')),
  error text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint provider_events_idempotency_key_key unique (idempotency_key)
);

drop index if exists provider_events_source_idx;
create index provider_events_source_idx on public.provider_events (event, created_at);
drop index if exists provider_events_status_idx;
create index provider_events_status_idx on public.provider_events (status, created_at);

-- 7. PROVIDER ACTIVITY LOGS ---------------------------------------------
-- Append-only observability trail. Never store credentials in message/meta.
create table if not exists public.provider_activity_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete set null,
  event text not null,
  level text not null default 'info' check (level in ('info','warn','error')),
  message text not null default '',
  meta jsonb,
  created_at timestamptz not null default now()
);

drop index if exists provider_activity_logs_provider_idx;
create index provider_activity_logs_provider_idx on public.provider_activity_logs (provider_id, created_at);
drop index if exists provider_activity_logs_level_idx;
create index provider_activity_logs_level_idx on public.provider_activity_logs (level, created_at);

-- 8. PROVIDER HEALTH CHECKS ---------------------------------------------
-- Append-only probe history used to compute the latest health state.
create table if not exists public.provider_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete cascade,
  status text not null check (status in ('healthy','degraded','unavailable','unknown')),
  response_time_ms int,
  error_class text,
  error_message text,
  rate_limit_remaining int,
  checked_at timestamptz not null default now()
);

drop index if exists provider_health_checks_provider_idx;
create index provider_health_checks_provider_idx on public.provider_health_checks (provider_id, checked_at);

-- 9. RLS ------------------------------------------------------------------
-- Infrastructure tables are service-role-only (like provisioning_jobs and
-- site_settings). No anon/authenticated policies: clients never read them.
alter table public.providers enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.provider_resources enable row level security;
alter table public.provider_sync_jobs enable row level security;
alter table public.provider_webhooks enable row level security;
alter table public.provider_events enable row level security;
alter table public.provider_activity_logs enable row level security;
alter table public.provider_health_checks enable row level security;

-- 10. BUILT-IN SEED --------------------------------------------------------
-- Mirrors the code adapters (src/lib/providers/registry.ts). Capabilities
-- are feature-level keys; status is a truthful starting state — providers
-- whose adapter is unconfigured start inactive until admin/health activates
-- them. Idempotent per unique slug.
insert into public.providers (slug, name, type, adapter, status, environment, capabilities, is_builtin, sort)
values
  ('hosting-simulated', 'Alojamento Simulado', 'hosting', 'simulatedHostingProvider', 'active', 'production',
   '["hosting.accounts","hosting.usage","hosting.websites","hosting.databases","hosting.backups","hosting.ssl","hosting.php","hosting.performance","hosting.security","hosting.alerts"]', true, 10),
  ('hosting-cpanel-whm', 'cPanel / WHM', 'hosting', 'whmProvider', 'inactive', 'production',
   '["hosting.accounts","hosting.suspend","hosting.unsuspend","hosting.terminate"]', true, 11),
  ('hosting-plesk', 'Plesk', 'hosting', 'pleskProvider', 'inactive', 'production',
   '["hosting.accounts","hosting.suspend","hosting.unsuspend","hosting.terminate"]', true, 12),
  ('hosting-cloud-vps', 'Cloud VPS', 'hosting', 'cloudVpsProvider', 'inactive', 'production',
   '["hosting.accounts","hosting.suspend","hosting.unsuspend","hosting.terminate"]', true, 13),
  ('dns-local', 'Registo DNS interno', 'dns', 'LocalDnsProvider', 'active', 'production',
   '["dns.zones","dns.records","dns.nameservers","dns.dnssec","dns.propagation"]', true, 20),
  ('domain-namecheap', 'Namecheap', 'domain', 'namecheapRegistrar', 'inactive', 'production',
   '["domain.search","domain.register","domain.renew","domain.nameservers"]', true, 30),
  ('domain-simulated', 'Registrador Simulado', 'domain', 'simulatedRegistrar', 'active', 'production',
   '["domain.search","domain.register","domain.renew","domain.nameservers"]', true, 31),
  ('ssl-letsencrypt', 'Let''s Encrypt', 'ssl', 'letsencryptSSL', 'inactive', 'production',
   '["ssl.issue","ssl.install","ssl.renew"]', true, 40),
  ('email-platform', 'Email da plataforma', 'email', 'platformEmail', 'inactive', 'production',
   '["email.mailboxes"]', true, 50)
on conflict (slug) do nothing;