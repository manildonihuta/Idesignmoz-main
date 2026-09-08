-- Site-wide admin settings, stored as JSON per key.
-- Only staff with the 'settings.manage' permission may write (guarded in the
-- API); values are read via the service role.

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- No public role can read or write settings directly; all access goes
-- through the authenticated admin API (service role bypasses RLS).
create policy "site_settings no anon read" on public.site_settings
  for select to anon using (false);
create policy "site_settings no anon write" on public.site_settings
  for all to anon using (false) with check (false);