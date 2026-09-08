-- ----------------------------------------------------------------------
-- IDesign Moz - initial full schema
-- Multi-tenant business model for the agency portal.
-- UUID primary keys everywhere (gen_random_uuid). Text + CHECK enums
-- (consistent with the existing migrations). Additive & idempotent:
-- tables already created by earlier migrations are extended via
-- 'alter table ... add column if not exists'.
-- ----------------------------------------------------------------------

-- ======================================================================
-- 1. ORGANIZATIONS / USERS / CUSTOMERS / EMPLOYEES
-- ======================================================================

-- Relax profiles.role CHECK (created in the initial schema migration) so
-- it accepts the full RBAC role set used by lib/security/rbac.ts.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'super_admin', 'admin', 'manager', 'sales',
    'developer', 'designer', 'support', 'customer', 'client'
  ));

create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique,
  email        text,
  phone        text,
  tax_id       text,                          -- NUIT / vat
  address      text,
  city         text,
  country      text not null default 'MZ',
  website      text,
  status       text not null default 'active'
               check (status in ('active', 'inactive', 'lead')),
  notes        text,
  created_by   uuid,                          -- public.users.id (FK added below)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  auth_id         uuid unique references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  email           text not null unique,
  full_name       text not null,
  phone           text,
  avatar_url      text,
  role            text not null default 'customer'
                  check (role in (
                    'super_admin', 'admin', 'manager', 'sales',
                    'developer', 'designer', 'support', 'customer', 'client'
                  )),
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id         uuid references public.users (id) on delete set null,
  name            text not null,
  email           text,
  phone           text,
  job_title       text,
  source          text,                       -- form, referral, newsletter, ...
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.employees (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  department    text,                         -- dev, design, sales, ...
  job_title     text,
  hired_at      date,
  status        text not null default 'active'
                check (status in ('active', 'on_leave', 'inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ======================================================================
-- 2. SERVICES / CATEGORIES / PACKAGES
-- ======================================================================

create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  description text,
  icon        text,                           -- lucide icon name
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories (id) on delete set null,
  name        text not null,
  slug        text unique,
  description text,
  price       numeric(12,2) not null default 0,  -- MT
  unit        text not null default 'once'
              check (unit in ('once', 'month', 'year')),
  active      boolean not null default true,
  sort        integer not null default 0,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.service_packages (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text unique,
  description      text,
  base_price       numeric(12,2) not null default 0,  -- MT
  discount_type    text check (discount_type in ('percent', 'fixed')),
  discount_value   numeric(12,2) not null default 0,
  popular          boolean not null default false,
  active           boolean not null default true,
  sort             integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Junction: which services a package bundles (M2M).
create table if not exists public.service_package_items (
  id         uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  qty        integer not null default 1,
  note       text,
  created_at timestamptz not null default now(),
  unique (package_id, service_id)
);

-- ======================================================================
-- 3. DOMAINS
-- ======================================================================

-- Extension price catalogue (already created by the domain_flow migration).
create table if not exists public.domain_extensions (
  id             uuid primary key default gen_random_uuid(),
  extension      text not null unique,
  registration   numeric not null,
  renewal        numeric not null,
  ideal_for      text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Registry + ownership. Extends the domain_flow migration table.
create table if not exists public.domains (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  extension     text not null,
  full_domain   text not null unique,
  status        text not null default 'available'
                check (status in ('available', 'registered', 'reserved', 'expired', 'transferred')),
  price         numeric,
  checked_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table public.domains add column if not exists customer_id      uuid references public.customers (id) on delete set null;
alter table public.domains add column if not exists organization_id  uuid references public.organizations (id) on delete set null;
alter table public.domains add column if not exists order_id         uuid;  -- public.orders.id (created below)
alter table public.domains add column if not exists registered_at    timestamptz;
alter table public.domains add column if not exists expires_at       timestamptz;
alter table public.domains add column if not exists registrar        text;
alter table public.domains add column if not exists auth_code        text;  -- encrypted (AES-256-GCM, APP_ENCRYPTION_KEY)
alter table public.domains add column if not exists auto_renew       boolean not null default true;
alter table public.domains add column if not exists notes            text;
alter table public.domains add column if not exists updated_at       timestamptz not null default now();

-- Domain orders (already created by the domain_flow migration).
create table if not exists public.domain_orders (
  id            uuid primary key default gen_random_uuid(),
  full_domain   text not null,
  extension     text not null,
  name          text not null,
  email         text not null,
  price         numeric not null,
  status        text not null default 'pending'
                check (status in ('pending', 'paid', 'registered', 'cancelled')),
  created_at    timestamptz not null default now()
);

alter table public.domain_orders add column if not exists customer_id     uuid references public.customers (id) on delete set null;
alter table public.domain_orders add column if not exists organization_id uuid references public.organizations (id) on delete set null;

-- ======================================================================
-- 4. HOSTING
-- ======================================================================

create table if not exists public.hosting_plans (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique,
  name           text not null,
  description    text,
  price_monthly  numeric(12,2) not null default 0,
  price_yearly   numeric(12,2) not null default 0,
  currency       text not null default 'MT',
  storage_gb     integer not null default 0,
  bandwidth_gb   integer not null default 0,
  sites          integer not null default 1,
  email_accounts integer not null default 0,
  databases      integer not null default 0,
  features       jsonb not null default '[]',
  support_level  text not null default 'standard',
  active         boolean not null default true,
  sort           integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.hosting_servers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  hostname     text,
  provider     text,                          -- cpanel provider / vps / ...
  region       text,
  ip_address   text,
  panel_url    text,
  os           text,
  status       text not null default 'active'
               check (status in ('active', 'maintenance', 'decommissioned')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.hosting_accounts (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  plan_id         uuid references public.hosting_plans (id) on delete set null,
  server_id       uuid references public.hosting_servers (id) on delete set null,
  domain          text,
  username        text,
  password_cipher text,                       -- encrypted (AES-256-GCM, APP_ENCRYPTION_KEY)
  status          text not null default 'pending'
                  check (status in ('pending', 'active', 'suspended', 'cancelled')),
  quota_gb        integer not null default 0,
  provisioned_at  timestamptz,
  renews_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ======================================================================
-- 5. ORDERS / ITEMS / PAYMENTS / SUBSCRIPTIONS
-- ======================================================================

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,
  customer_id     uuid references public.customers (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded')),
  subtotal        numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate        numeric(5,2) not null default 15,
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  currency        text not null default 'MZN',
  coupon_id       uuid,                       -- public.coupons.id (FK added below)
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  kind         text not null default 'custom'
               check (kind in ('service', 'package', 'domain', 'hosting', 'custom')),
  ref_id       uuid,                          -- services / packages / domains / hosting_plans
  label        text not null,
  description  text,
  qty          integer not null default 1,
  unit_price   numeric(12,2) not null default 0,
  line_total   numeric(12,2) not null default 0,
  meta         jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid references public.orders (id) on delete set null,
  invoice_id      uuid,                       -- public.invoices.id (FK added below)
  customer_id     uuid references public.customers (id) on delete set null,
  method          text not null default 'mpesa'
                  check (method in ('mpesa', 'card', 'bank_transfer', 'cash')),
  reference       text,
  amount          numeric(12,2) not null default 0,
  currency        text not null default 'MZN',
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at         timestamptz,
  meta            jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  kind            text not null check (kind in ('hosting', 'service', 'package')),
  plan_id         uuid,
  period          text not null default 'month' check (period in ('month', 'year')),
  price           numeric(12,2) not null default 0,
  currency        text not null default 'MZN',
  status          text not null default 'active'
                  check (status in ('active', 'paused', 'cancelled', 'expired')),
  starts_at       timestamptz not null default now(),
  renews_at       timestamptz,
  auto_renew      boolean not null default true,
  payment_method  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ======================================================================
-- 6. INVOICES
-- ======================================================================

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,
  customer_id     uuid references public.customers (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  order_id        uuid references public.orders (id) on delete set null,
  status          text not null default 'draft'
                  check (status in ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
  subtotal        numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_rate        numeric(5,2) not null default 15,
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  currency        text not null default 'MZN',
  issued_at       timestamptz,
  due_at          timestamptz,
  paid_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  qty         integer not null default 1,
  unit_price  numeric(12,2) not null default 0,
  line_total  numeric(12,2) not null default 0,
  tax_rate    numeric(5,2) not null default 15,
  created_at  timestamptz not null default now()
);

-- ======================================================================
-- 7. PROJECTS / TASKS / COMMENTS
-- ======================================================================

-- Projects base table (created by the initial schema migration).
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

alter table public.projects add column if not exists customer_id     uuid references public.customers (id) on delete set null;
alter table public.projects add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.projects add column if not exists manager_id      uuid references public.users (id) on delete set null;
alter table public.projects add column if not exists budget          numeric(12,2);
alter table public.projects add column if not exists start_date      date;
alter table public.projects add column if not exists deadline        date;
alter table public.projects add column if not exists tags            text[] not null default '{}';

create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  assignee_id uuid references public.users (id) on delete set null,
  title       text not null,
  description text,
  status      text not null default 'todo'
              check (status in ('todo', 'in_progress', 'done', 'blocked')),
  priority    text not null default 'medium'
              check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at      timestamptz,
  completed_at timestamptz,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  author_id   uuid references public.users (id) on delete set null,
  parent_id   uuid references public.project_comments (id) on delete cascade,
  body        text not null,
  attachments jsonb,
  created_at  timestamptz not null default now()
);

-- ======================================================================
-- 8. TICKETS / MESSAGES
-- ======================================================================

create table if not exists public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  number             text unique,
  customer_id        uuid references public.customers (id) on delete set null,
  organization_id    uuid references public.organizations (id) on delete set null,
  subject            text not null,
  status             text not null default 'open'
                     check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority           text not null default 'medium'
                     check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id        uuid references public.users (id) on delete set null,
  channel            text not null default 'portal' check (channel in ('portal', 'email', 'phone')),
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid references public.users (id) on delete set null,
  author_email text,
  body        text not null,
  is_internal boolean not null default false,
  attachments jsonb,
  created_at  timestamptz not null default now()
);

-- ======================================================================
-- 9. PROPOSALS (extends proposal_system migration) + ITEMS
-- ======================================================================

alter table public.proposals add column if not exists version   integer not null default 1;
alter table public.proposals add column if not exists created_by uuid references public.users (id) on delete set null;

create table if not exists public.proposal_items (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals (id) on delete cascade,
  kind         text not null default 'custom'
               check (kind in ('service', 'package', 'custom')),
  service_id   uuid references public.services (id) on delete set null,
  label        text not null,
  description  text,
  qty          integer not null default 1,
  unit_price   integer not null default 0,    -- MT
  line_total   integer not null default 0,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ======================================================================
-- 10. PORTFOLIO + CATEGORIES
-- ======================================================================

create table if not exists public.portfolio_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  description text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.portfolio (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text unique,
  category_id   uuid references public.portfolio_categories (id) on delete set null,
  description   text,
  cover_url     text,
  gallery       jsonb not null default '[]',
  tech_stack    text[] not null default '{}',
  client        text,
  industry      text,
  project_url   text,
  featured      boolean not null default false,
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'archived')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ======================================================================
-- 11. BLOG + CATEGORIES
-- ======================================================================

create table if not exists public.blog_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  description text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,
  title         text not null,
  excerpt       text,
  content       text not null,
  cover_url     text,
  category_id   uuid references public.blog_categories (id) on delete set null,
  author_id     uuid references public.users (id) on delete set null,
  tags          text[] not null default '{}',
  status        text not null default 'draft'
                check (status in ('draft', 'published', 'archived')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ======================================================================
-- 12. COUPONS / DISCOUNTS
-- ======================================================================

create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,        -- uppercased
  kind           text not null check (kind in ('percent', 'fixed')),
  value          numeric(12,2) not null default 0,
  min_subtotal   numeric(12,2) not null default 0,
  max_discount   numeric(12,2),
  max_uses       integer,
  used_count     integer not null default 0,
  valid_from     timestamptz,
  valid_until    timestamptz,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.discounts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  kind          text not null check (kind in ('percent', 'fixed')),
  value         numeric(12,2) not null default 0,
  code          text,                         -- optional coupon-like code
  scope         text not null default 'order'
                check (scope in ('service', 'package', 'order', 'hosting')),
  ref_id        uuid,                         -- services.id / service_packages.id / hosting_plans.id
  starts_at     timestamptz,
  ends_at       timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ======================================================================
-- 13. NOTIFICATIONS
-- ======================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.users (id) on delete cascade,
  kind         text not null default 'system',
  title        text not null,
  body         text,
  link         text,
  read_at      timestamptz,
  meta         jsonb,
  created_at   timestamptz not null default now()
);

-- ======================================================================
-- 14. AUDIT LOGS (created by the security migration; kept idempotent)
-- ======================================================================

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  entity      text not null,
  entity_id   text,
  actor_id    uuid,
  actor_email text,
  actor_role  text,
  ip          text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- ======================================================================
-- DEFERRED FOREIGN KEYS
-- (invoices/coupons referenced before their own creation above)
-- ======================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_invoice_fk') then
    alter table public.payments add constraint payments_invoice_fk
      foreign key (invoice_id) references public.invoices (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'domains_order_fk') then
    alter table public.domains add constraint domains_order_fk
      foreign key (order_id) references public.orders (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_coupon_fk') then
    alter table public.orders add constraint orders_coupon_fk
      foreign key (coupon_id) references public.coupons (id) on delete set null;
  end if;
end $$;

-- ======================================================================
-- INDEXES (foreign keys + common lookups)
-- ======================================================================

create index if not exists users_org_idx            on public.users (organization_id);
create index if not exists customers_org_idx        on public.customers (organization_id);
create index if not exists customers_user_idx       on public.customers (user_id);
create index if not exists employees_user_idx       on public.employees (user_id);
create index if not exists employees_org_idx        on public.employees (organization_id);
create index if not exists services_category_idx    on public.services (category_id);
create index if not exists package_items_package_idx on public.service_package_items (package_id);
create index if not exists package_items_service_idx on public.service_package_items (service_id);
create index if not exists domains_customer_idx     on public.domains (customer_id);
create index if not exists domains_org_idx          on public.domains (organization_id);
create index if not exists domains_order_idx        on public.domains (order_id);
create index if not exists domain_orders_customer_idx on public.domain_orders (customer_id);
create index if not exists hosting_accounts_customer_idx on public.hosting_accounts (customer_id);
create index if not exists hosting_accounts_plan_idx on public.hosting_accounts (plan_id);
create index if not exists hosting_accounts_server_idx on public.hosting_accounts (server_id);
create index if not exists orders_customer_idx     on public.orders (customer_id);
create index if not exists orders_org_idx          on public.orders (organization_id);
create index if not exists order_items_order_idx   on public.order_items (order_id);
create index if not exists payments_order_idx      on public.payments (order_id);
create index if not exists payments_invoice_idx    on public.payments (invoice_id);
create index if not exists payments_customer_idx   on public.payments (customer_id);
create index if not exists subscriptions_customer_idx on public.subscriptions (customer_id);
create index if not exists invoices_customer_idx   on public.invoices (customer_id);
create index if not exists invoices_org_idx        on public.invoices (organization_id);
create index if not exists invoices_order_idx      on public.invoices (order_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists projects_customer_idx   on public.projects (customer_id);
create index if not exists projects_org_idx        on public.projects (organization_id);
create index if not exists projects_manager_idx    on public.projects (manager_id);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id);
create index if not exists project_tasks_assignee_idx on public.project_tasks (assignee_id);
create index if not exists project_comments_project_idx on public.project_comments (project_id);
create index if not exists tickets_customer_idx    on public.tickets (customer_id);
create index if not exists tickets_assignee_idx    on public.tickets (assignee_id);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id);
create index if not exists proposal_items_proposal_idx on public.proposal_items (proposal_id);
create index if not exists portfolio_category_idx  on public.portfolio (category_id);
create index if not exists portfolio_status_idx    on public.portfolio (status);
create index if not exists blog_category_idx       on public.blog_posts (category_id);
create index if not exists blog_author_idx         on public.blog_posts (author_id);
create index if not exists blog_status_idx         on public.blog_posts (status);
create index if not exists coupons_code_idx        on public.coupons (code);
create index if not exists discounts_scope_idx     on public.discounts (scope);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id);
create index if not exists audit_logs_action_idx   on public.audit_logs (action);
create index if not exists audit_logs_entity_idx   on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_created_idx  on public.audit_logs (created_at desc);

-- ======================================================================
-- UPDATED_AT TRIGGERS (reuse set_updated_at helper from initial schema)
-- ======================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'users', 'customers', 'employees', 'services',
    'service_packages', 'domains', 'hosting_plans', 'hosting_servers',
    'hosting_accounts', 'orders', 'subscriptions', 'invoices',
    'projects', 'project_tasks', 'tickets', 'portfolio', 'blog_posts',
    'discounts'
  ] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
      execute format(
        'create trigger %I_set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',
        t, t
      );
    end if;
  end loop;
end $$;