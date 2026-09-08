-- ============================================================================
-- IDesign Moz — UX Conversion: activation pipeline + website onboarding
-- ----------------------------------------------------------------------------
-- Bridges the three purchase journeys end-to-end using real DB state:
--
--   HOSTING : checkout → hosting_accounts (pending) + provisioning_job
--             cron /api/cron/provisioning → runHostingProvisioningFlow → active
--   DOMAIN  : checkout → domains (pending) + domain_orders (paid) + provisioning_job
--             cron → runDomainProvisioningFlow → registered
--   WEBSITE : /websites (packages) → brief → proposal (project_id) → approval
--             → projects.status active → tracked in /dashboard/projects
--
-- All prices relevant to the journeys remain in DB tables (service_packages,
-- services, hosting_plans, domain_extensions). No prices hard-coded in code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Provisioning jobs queue (drives the async activation cron)
-- ----------------------------------------------------------------------------
create table if not exists public.provisioning_jobs (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders (id) on delete cascade,
  kind         text not null check (kind in ('hosting', 'domain')),
  ref_id       uuid not null,                    -- hosting_accounts.id | domains.id
  status       text not null default 'pending'
               check (status in ('pending', 'running', 'done', 'failed')),
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  last_error   text,
  run_after    timestamptz not null default now(),
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists provisioning_jobs_open_idx
  on public.provisioning_jobs (status, run_after);
create index if not exists provisioning_jobs_order_idx
  on public.provisioning_jobs (order_id);

alter table public.provisioning_jobs enable row level security;

-- ----------------------------------------------------------------------------
-- 2. hosting_accounts — link to order/subscription + provisioning results
-- ----------------------------------------------------------------------------
alter table public.hosting_accounts add column if not exists order_id         uuid references public.orders (id) on delete set null;
alter table public.hosting_accounts add column if not exists subscription_id   uuid references public.subscriptions (id) on delete set null;
alter table public.hosting_accounts add column if not exists panel_url         text;
alter table public.hosting_accounts add column if not exists server_ip         text;
alter table public.hosting_accounts add column if not exists nameservers       jsonb not null default '[]';
alter table public.hosting_accounts add column if not exists terminated_at     timestamptz;

-- The billing lifecycle advances suspended -> terminated; keep the CHECK aligned.
alter table public.hosting_accounts drop constraint if exists hosting_accounts_status_check;
alter table public.hosting_accounts add constraint hosting_accounts_status_check
  check (status in ('pending', 'active', 'suspended', 'terminated', 'cancelled'));

-- ----------------------------------------------------------------------------
-- 3. domains — allow the transient 'pending' (between checkout and registration)
-- ----------------------------------------------------------------------------
alter table public.domains drop constraint if exists domains_status_check;
alter table public.domains add constraint domains_status_check
  check (status in ('available', 'pending', 'registered', 'reserved', 'expired', 'transferred'));

-- ----------------------------------------------------------------------------
-- 4. projects — client work-flow states for the website journey
--    (brief -> active -> on_hold -> done; cancelled aborts). The original
--    portfolio states (draft/published/archived) are preserved.
-- ----------------------------------------------------------------------------
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('draft', 'published', 'archived', 'brief', 'active', 'on_hold', 'done', 'cancelled'));

-- ----------------------------------------------------------------------------
-- 5. proposals — link to the client project created from the brief
-- ----------------------------------------------------------------------------
alter table public.proposals add column if not exists project_id uuid references public.projects (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 6. Website packages (DB-driven — prices live here, never in components)
-- ----------------------------------------------------------------------------
insert into public.services (name, slug, description, price, unit, active, sort) values
  ('Criação de website',          'website-build',       'Desenho e desenvolvimento do website à medida.', 0, 'once', true, 1),
  ('Design responsivo e UX',      'website-design',      'Interface adaptada a telemóveis e experiência de utilizador.', 0, 'once', true, 2),
  ('SEO básico',                  'website-seo',         'Otimização inicial para motores de busca.', 0, 'once', true, 3),
  ('Formulário de contacto',      'website-contact-form','Formulário de contacto com notificações por email.', 0, 'once', true, 4),
  ('Loja online (até 30 produtos)','website-shop-30',    'Catálogo, carrinho e checkout integrados.', 0, 'once', true, 5),
  ('Pagamentos online (M-Pesa)',  'website-payments',    'Integração de pagamentos móveis.', 0, 'once', true, 6),
  ('Gestão de conteúdos (CMS)',   'website-cms',         'Edição de conteúdos do site sem programar.', 0, 'once', true, 7),
  ('Formação e manuais',          'website-training',    'Sessão de formação e documentação do site.', 0, 'once', true, 8)
on conflict (slug) do nothing;

insert into public.service_packages (name, slug, description, base_price, discount_type, discount_value, popular, active, sort) values
  ('Landing Page',       'landing-page',       'Página única de alta conversão para lançar um produto, serviço ou campanha.', 25000,  null,   0, false, true, 10),
  ('Site Institucional', 'site-institucional', 'Website completo para a empresa — sobre, serviços, contactos e blog.',            35000,  'fixed', 0, true,  true, 20),
  ('Loja Online',        'loja-online',        'E-commerce com catálogo, carrinho e pagamentos móveis em Moçambique.',           85000,  'fixed', 0, false, true, 30),
  ('Website Premium',    'website-premium',    'Solução completa de presença digital com loja, SEO e formação.',                   145000, 'fixed', 0, false, true, 40)
on conflict (slug) do nothing;

insert into public.service_package_items (package_id, service_id, qty, note)
select pkg.id, svc.id, 1, null
from public.service_packages pkg
join public.services svc on (
  (pkg.slug = 'landing-page'       and svc.slug in ('website-build', 'website-design', 'website-seo'))
  or (pkg.slug = 'site-institucional' and svc.slug in ('website-build', 'website-design', 'website-contact-form', 'website-cms'))
  or (pkg.slug = 'loja-online'      and svc.slug in ('website-build', 'website-design', 'website-shop-30', 'website-payments', 'website-cms'))
  or (pkg.slug = 'website-premium'  and svc.slug in ('website-build', 'website-design', 'website-seo', 'website-contact-form', 'website-shop-30', 'website-payments', 'website-cms', 'website-training'))
)
where not exists (
  select 1 from public.service_package_items existing
  where existing.package_id = pkg.id and existing.service_id = svc.id
);