-- ----------------------------------------------------------------------
-- IDesign Moz — Hosting Control Panel
--
-- cPanel-style self-management module for customer hosting accounts.
-- All entities are keyed to hosting_accounts and mirror the DNS module
-- conventions: uuid pk, touch_updated_at trigger, owner RLS via a
-- security-definer helper. Passwords are stored encrypted (AES-256-GCM,
-- APP_ENCRYPTION_KEY) and never exposed after creation.
--
-- Incremental + additive: every statement guards with IF NOT EXISTS so it
-- re-runs safely on an already-migrated schema.
-- ----------------------------------------------------------------------

-- 1. HOSTING PLANS — extended per-plan limits (cpu/memory/backups/inodes/php)
alter table public.hosting_plans add column if not exists cpu_cores     integer not null default 1;
alter table public.hosting_plans add column if not exists memory_mb     integer not null default 2048;
alter table public.hosting_plans add column if not exists backups       integer not null default 1;
alter table public.hosting_plans add column if not exists inodes        integer not null default 250000;
alter table public.hosting_plans add column if not exists php_versions  jsonb    not null default '["8.3","8.2","8.1"]'::jsonb;

-- 2. HOSTING ACCOUNTS — optional explicit expiry (defaults from renews_at)
alter table public.hosting_accounts add column if not exists expires_at timestamptz;

-- ----------------------------------------------------------------------
-- 3. HOSTING USAGE — measured snapshots (latest row per account drives UI)
-- ----------------------------------------------------------------------
create table if not exists public.hosting_usage (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  measured_at        timestamptz not null default now(),
  storage_mb         integer not null default 0,
  bandwidth_mb       integer not null default 0,
  inodes             integer not null default 0,
  cpu_percent        numeric(5,2) not null default 0,
  memory_percent     numeric(5,2) not null default 0,
  sites              integer not null default 0,
  databases          integer not null default 0,
  email_accounts     integer not null default 0
);

create index if not exists hosting_usage_account_idx
  on public.hosting_usage (hosting_account_id, measured_at desc);

-- ----------------------------------------------------------------------
-- 4. HOSTING WEBSITES — managed sites attached to the account
-- ----------------------------------------------------------------------
create table if not exists public.hosting_websites (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  domain             text not null,
  status             text not null default 'online'
                     check (status in ('online', 'offline', 'suspended', 'error')),
  app                text,
  php_version        text,
  ssl_status         text not null default 'none'
                     check (ssl_status in ('none', 'pending', 'active', 'expired', 'failed')),
  ssl_expires_at     timestamptz,
  document_root      text,
  storage_mb         integer not null default 0,
  last_backup_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (hosting_account_id, domain)
);

create index if not exists hosting_websites_account_idx
  on public.hosting_websites (hosting_account_id);

-- ----------------------------------------------------------------------
-- 5. HOSTING DATABASES — credentials ciphertext, shown only at creation
-- ----------------------------------------------------------------------
create table if not exists public.hosting_databases (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  name               text not null,
  engine             text not null default 'mysql'
                     check (engine in ('mysql', 'postgresql')),
  size_mb            integer not null default 0,
  db_user            text,
  password_cipher    text,          -- AES-256-GCM (APP_ENCRYPTION_KEY)
  status             text not null default 'active'
                     check (status in ('active', 'suspended', 'dropped')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (hosting_account_id, name)
);

create index if not exists hosting_databases_account_idx
  on public.hosting_databases (hosting_account_id);

-- ----------------------------------------------------------------------
-- 6. HOSTING BACKUPS — statused jobs in the style of provisioning. The
--    snapshot is the platform-managed state captured at creation time and
--    used by restore.
-- ----------------------------------------------------------------------
create table if not exists public.hosting_backups (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  kind               text not null default 'full'
                     check (kind in ('full', 'website', 'database', 'files', 'automatic')),
  label              text not null default 'Backup',
  ref_id             uuid,          -- hosting_websites.id | hosting_databases.id for partial backups
  size_mb            integer not null default 0,
  status             text not null default 'queued'
                     check (status in ('queued', 'processing', 'completed', 'failed', 'restoring')),
  snapshot           jsonb,         -- captured managed state (websites/databases/limits at time of backup)
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  updated_at         timestamptz not null default now()
);

create index if not exists hosting_backups_account_idx
  on public.hosting_backups (hosting_account_id, created_at desc);

-- ----------------------------------------------------------------------
-- 7. HOSTING SSL CERTIFICATES — managed certificate records
-- ----------------------------------------------------------------------
create table if not exists public.hosting_ssl_certificates (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  domain             text not null,
  provider           text not null default 'letsencrypt',
  status             text not null default 'pending'
                     check (status in ('pending', 'active', 'renewing', 'expired', 'failed')),
  issued_at          timestamptz,
  expires_at         timestamptz,
  auto_renew         boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (hosting_account_id, domain)
);

create index if not exists hosting_ssl_account_idx
  on public.hosting_ssl_certificates (hosting_account_id);

-- ----------------------------------------------------------------------
-- 8. HOSTING CRON JOBS — scheduled commands (surfaced only when the
--    provider advertises the 'cron' capability)
-- ----------------------------------------------------------------------
create table if not exists public.hosting_cron_jobs (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  command            text not null,
  schedule           text not null,
  status             text not null default 'enabled'
                     check (status in ('enabled', 'disabled')),
  last_run_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists hosting_cron_account_idx
  on public.hosting_cron_jobs (hosting_account_id);

-- ----------------------------------------------------------------------
-- 9. RESOURCE ALERTS — quota/health events surfaced in-panel + via EVENTS
-- ----------------------------------------------------------------------
create table if not exists public.resource_alerts (
  id                 uuid primary key default gen_random_uuid(),
  hosting_account_id uuid not null references public.hosting_accounts (id) on delete cascade,
  kind               text not null
                     check (kind in ('storage_80', 'storage_90', 'cpu_high', 'memory_high',
                                     'bandwidth_limit', 'backup_failed', 'ssl_expiring',
                                     'website_offline', 'quota_reached')),
  level              text not null default 'info'
                     check (level in ('info', 'warn', 'danger')),
  message            text not null,
  status             text not null default 'open'
                     check (status in ('open', 'acked')),
  created_at         timestamptz not null default now(),
  acked_at           timestamptz
);

create index if not exists resource_alerts_account_idx
  on public.resource_alerts (hosting_account_id, created_at desc);

-- ----------------------------------------------------------------------
-- 10. UPDATED_AT TRIGGERS (uses the shared touch_updated_at from DNS module)
-- ----------------------------------------------------------------------
drop trigger if exists hosting_websites_touch on public.hosting_websites;
create trigger hosting_websites_touch
  before update on public.hosting_websites
  for each row execute function public.touch_updated_at();

drop trigger if exists hosting_databases_touch on public.hosting_databases;
create trigger hosting_databases_touch
  before update on public.hosting_databases
  for each row execute function public.touch_updated_at();

drop trigger if exists hosting_backups_touch on public.hosting_backups;
create trigger hosting_backups_touch
  before update on public.hosting_backups
  for each row execute function public.touch_updated_at();

drop trigger if exists hosting_ssl_certificates_touch on public.hosting_ssl_certificates;
create trigger hosting_ssl_certificates_touch
  before update on public.hosting_ssl_certificates
  for each row execute function public.touch_updated_at();

drop trigger if exists hosting_cron_jobs_touch on public.hosting_cron_jobs;
create trigger hosting_cron_jobs_touch
  before update on public.hosting_cron_jobs
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY — every panel table is only visible to the
--     hosting account owner (hosting_accounts.customer_id = auth.uid()).
--     Server routes read/write via the service role (bypasses RLS).
-- ----------------------------------------------------------------------
create or replace function public.is_hosting_account_owner(account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1 from public.hosting_accounts a
      where a.id = account_id and a.customer_id = auth.uid()
    );
$$;

alter table public.hosting_usage            enable row level security;
alter table public.hosting_websites         enable row level security;
alter table public.hosting_databases        enable row level security;
alter table public.hosting_backups          enable row level security;
alter table public.hosting_ssl_certificates enable row level security;
alter table public.hosting_cron_jobs        enable row level security;
alter table public.resource_alerts          enable row level security;

-- USAGE
create policy "owners can read hosting usage"
  on public.hosting_usage for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can insert hosting usage"
  on public.hosting_usage for insert
  with check (is_hosting_account_owner(hosting_account_id));

-- WEBSITES
create policy "owners can read hosting websites"
  on public.hosting_websites for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can create hosting websites"
  on public.hosting_websites for insert
  with check (is_hosting_account_owner(hosting_account_id));

create policy "owners can update hosting websites"
  on public.hosting_websites for update
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can delete hosting websites"
  on public.hosting_websites for delete
  using (is_hosting_account_owner(hosting_account_id));

-- DATABASES
create policy "owners can read hosting databases"
  on public.hosting_databases for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can create hosting databases"
  on public.hosting_databases for insert
  with check (is_hosting_account_owner(hosting_account_id));

create policy "owners can update hosting databases"
  on public.hosting_databases for update
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can delete hosting databases"
  on public.hosting_databases for delete
  using (is_hosting_account_owner(hosting_account_id));

-- BACKUPS
create policy "owners can read hosting backups"
  on public.hosting_backups for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can create hosting backups"
  on public.hosting_backups for insert
  with check (is_hosting_account_owner(hosting_account_id));

create policy "owners can update hosting backups"
  on public.hosting_backups for update
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can delete hosting backups"
  on public.hosting_backups for delete
  using (is_hosting_account_owner(hosting_account_id));

-- SSL
create policy "owners can read hosting ssl"
  on public.hosting_ssl_certificates for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can create hosting ssl"
  on public.hosting_ssl_certificates for insert
  with check (is_hosting_account_owner(hosting_account_id));

create policy "owners can update hosting ssl"
  on public.hosting_ssl_certificates for update
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can delete hosting ssl"
  on public.hosting_ssl_certificates for delete
  using (is_hosting_account_owner(hosting_account_id));

-- CRON
create policy "owners can read hosting cron jobs"
  on public.hosting_cron_jobs for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can create hosting cron jobs"
  on public.hosting_cron_jobs for insert
  with check (is_hosting_account_owner(hosting_account_id));

create policy "owners can update hosting cron jobs"
  on public.hosting_cron_jobs for update
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can delete hosting cron jobs"
  on public.hosting_cron_jobs for delete
  using (is_hosting_account_owner(hosting_account_id));

-- ALERTS
create policy "owners can read resource alerts"
  on public.resource_alerts for select
  using (is_hosting_account_owner(hosting_account_id));

create policy "owners can ack resource alerts"
  on public.resource_alerts for update
  using (is_hosting_account_owner(hosting_account_id));