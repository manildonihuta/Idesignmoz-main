-- ----------------------------------------------------------------------
-- IDesign Moz — domain expiration reminders
-- Tracks which notification stage has already been delivered for a domain
-- so the daily cron escalates 30d -> 15d -> 7d -> 1d exactly once each.
--   stage '30'  first email notification
--   stage '15'  reminder
--   stage '7'   urgent reminder
--   stage '1'   urgent notification (last call)
--   stage 'auto_renew' renewal order prepared (billing ready for payment)
-- Service-role only: RLS is enabled with no client policies.
-- ----------------------------------------------------------------------

create table if not exists public.domain_expiration_stages (
  id          uuid primary key default gen_random_uuid(),
  full_domain text not null,
  stage       text not null
              check (stage in ('30', '15', '7', '1', 'auto_renew')),
  sent_at     timestamptz not null default now(),
  unique (full_domain, stage)
);

create index if not exists domain_expiration_stages_domain_idx
  on public.domain_expiration_stages (full_domain);

alter table public.domain_expiration_stages enable row level security;