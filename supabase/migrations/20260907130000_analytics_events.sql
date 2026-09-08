-- ----------------------------------------------------------------------
-- IDesign Moz - anonymous storefront analytics
-- analytics_events: privacy-first, non-identifiable event log used to
-- power the admin Analytics panel and the conversion funnel.
--
-- Privacy notes:
--  * visitor_id is an opaque per-browser uuid (first-party cookie), never
--    mapped to an identity (no email/name/IP stored here).
--  * No IP addresses, emails, names or raw page content are persisted.
--  * Kept as aggregate counts at query time; rows may be pruned.
-- ----------------------------------------------------------------------

create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  visitor_id text not null,          -- anonymous per-browser cookie (uuid)
  event      text not null,          -- pageview|domain_search|signup|cart_add|checkout|purchase|customer
  page       text,                   -- path where the event occurred
  value      numeric(12,2),          -- optional amount (e.g. purchase revenue)
  meta       jsonb,                  -- optional free-form context
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx  on public.analytics_events (created_at);
create index if not exists analytics_events_visitor_idx  on public.analytics_events (visitor_id, event, created_at);
create index if not exists analytics_events_event_idx    on public.analytics_events (event, created_at);

-- Written exclusively with the service-role key (bypasses RLS); leave RLS
-- disabled so service-role writes are always allowed (same as audit_logs).
