-- ============================================================================
-- IDesign Moz — AI Website Builder
-- ----------------------------------------------------------------------------
-- 1. builder_sites  : one row per AI-generated website (linked to a project).
-- 2. builder_pages  : normalized pages, each holding a JSONB section list.
-- The generated copy/structure lives in the DB (no client-side mock), RLS is
-- enabled: public readers only see PUBLISHED sites; owners manage their own.
-- Writes go through the service role (supabaseAdmin) like the rest of the app.
-- ============================================================================

create table if not exists public.builder_sites (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects (id) on delete set null,
  client_id     uuid references public.profiles (id) on delete cascade,
  title         text not null default '',
  business_name text not null default '',
  domain        text,
  industry      text,
  tagline       text not null default '',
  brief         text not null default '',
  theme         jsonb not null default '{}',   -- {primaryColor, accentColor, mode, font}
  seo           jsonb not null default '{}',   -- {title, description}
  status        text not null default 'draft'
                check (status in ('draft', 'generating', 'ready', 'failed', 'published', 'archived')),
  error         text,
  generated_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists builder_sites_client_idx on public.builder_sites (client_id);
create index if not exists builder_sites_status_idx on public.builder_sites (status);
create index if not exists builder_sites_project_idx on public.builder_sites (project_id);

create table if not exists public.builder_pages (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.builder_sites (id) on delete cascade,
  slug        text not null,
  title       text not null,
  nav_label   text,
  sort        integer not null default 0,
  sections    jsonb not null default '[]',   -- array of section objects (see ai/builder-schema)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (site_id, slug)
);

create index if not exists builder_pages_site_idx on public.builder_pages (site_id, sort);

alter table public.builder_sites enable row level security;
alter table public.builder_pages enable row level security;

-- Public readers may only see PUBLISHED sites (preview goes through the
-- service role, but RLS stays correct for future portal apps).
create policy "anyone can read published builder sites"
  on public.builder_sites for select
  using (status = 'published');

create policy "anyone can read pages of published builder sites"
  on public.builder_pages for select
  using (exists (
    select 1 from public.builder_sites s
    where s.id = builder_pages.site_id and s.status = 'published'
  ));

-- Owners manage their own sites and their pages.
create policy "users manage own builder sites"
  on public.builder_sites for all
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy "users manage pages of own builder sites"
  on public.builder_pages for all
  using (exists (
    select 1 from public.builder_sites s
    where s.id = builder_pages.site_id and s.client_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.builder_sites s
    where s.id = builder_pages.site_id and s.client_id = auth.uid()
  ));

-- Keep updated_at fresh on edits (site fields / section edits).
drop trigger if exists builder_sites_set_updated_at on public.builder_sites;
create trigger builder_sites_set_updated_at
  before update on public.builder_sites
  for each row execute procedure public.set_updated_at();

drop trigger if exists builder_pages_set_updated_at on public.builder_pages;
create trigger builder_pages_set_updated_at
  before update on public.builder_pages
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- Atomic page regeneration: delete + re-insert all pages of a site in one
-- transaction (service-role only) so a regenerated site never ends up half
-- written. Ownership is enforced by the application layer before calling it.
-- ============================================================================

create or replace function public.replace_builder_pages(
  p_site_id uuid,
  p_pages jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page jsonb;
begin
  delete from public.builder_pages where site_id = p_site_id;
  for v_page in select * from jsonb_array_elements(p_pages) loop
    insert into public.builder_pages (site_id, slug, title, nav_label, sort, sections)
    values (
      p_site_id,
      v_page->>'slug',
      v_page->>'title',
      nullif(v_page->>'nav_label', ''),
      coalesce((v_page->>'sort')::int, 0),
      coalesce(v_page->'sections', '[]'::jsonb)
    );
  end loop;
end;
$$;

revoke all on function public.replace_builder_pages(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_builder_pages(uuid, jsonb) to service_role;