-- ============================================================================
-- 20260913150000_email_features.sql
-- ----------------------------------------------------------------------------
-- Slice 3 — Aliases, Forwarding & Autoresponder.
--
-- Additive-only, follows Slice 1/2 conventions (RLS + service-role only,
-- shared set_updated_at(), uuid PKs, soft-delete via status = 'deleted').
--
-- New:
--   email_aliases  — address aliases of a service (alias -> destination).
--                    cPanel maps these to forwarders. NO passwords anywhere.
--   email_mailboxes.forward_to      — jsonb array of forward destinations
--   email_mailboxes.autoresponder   — jsonb {enabled,subject,body,...} | null
-- ============================================================================

-- ============================================================================
-- 1. EMAIL ALIASES — alias_address -> destination (mailbox or external)
-- ============================================================================

create table if not exists public.email_aliases (
  id                uuid primary key default gen_random_uuid(),
  email_service_id  uuid not null references public.email_services (id) on delete cascade,
  alias_address     text not null,          -- e.g. vendas@example.com
  destination       text not null,          -- e.g. info@example.com or external
  status            text not null default 'active'
                    check (status in ('active', 'disabled', 'error', 'deleted')),
  provider_alias_id text,
  meta              jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists email_aliases_service_idx on public.email_aliases (email_service_id);
create index if not exists email_aliases_status_idx  on public.email_aliases (status);
create unique index if not exists email_aliases_address_idx on public.email_aliases (lower(alias_address))
  where status <> 'deleted';

drop trigger if exists email_aliases_set_updated_at on public.email_aliases;
create trigger email_aliases_set_updated_at
  before update on public.email_aliases
  for each row execute procedure public.set_updated_at();

alter table public.email_aliases enable row level security;

-- ============================================================================
-- 2. EMAIL MAILBOXES — forwarding + autoresponder
-- ============================================================================

alter table public.email_mailboxes
  add column if not exists forward_to jsonb not null default '[]'::jsonb;

alter table public.email_mailboxes
  add column if not exists autoresponder jsonb;