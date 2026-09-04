-- ----------------------------------------------------------------------
-- IDesign Moz — database schema
-- Client portal (auth profiles) + contact messages + projects
-- ----------------------------------------------------------------------

-- 1. PROFILES -----------------------------------------------------------
-- One-to-one with Supabase Auth users (auth.users). Holds portal identity.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  company     text,
  phone       text,
  role        text not null default 'client'
              check (role in ('client', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-copy metadata (full_name) from auth on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CONTACT MESSAGES ---------------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  service     text not null default 'Outra necessidade',
  message     text not null,
  status      text not null default 'new'
              check (status in ('new', 'in_progress', 'done')),
  created_at  timestamptz not null default now()
);

-- 3. PROJECTS (portfolio / client work) ---------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.profiles (id) on delete set null,
  title       text not null,
  slug        text unique,
  description text,
  category    text,
  cover_url   text,
  status      text not null default 'draft'
              check (status in ('draft', 'published', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.contact_messages enable row level security;
alter table public.projects     enable row level security;

-- Profiles: a user can read/update their own profile; admins read all.
create policy "users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Contact messages: only authenticated (admin) can read; anyone can insert.
create policy "anyone can submit contact message"
  on public.contact_messages for insert
  with check (true);

create policy "authenticated can read contact messages"
  on public.contact_messages for select
  using (auth.role() = 'authenticated');

-- Projects: authenticated clients can read published projects.
create policy "authenticated can read published projects"
  on public.projects for select
  using (status = 'published');

create policy "authenticated can manage own projects"
  on public.projects for all
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
