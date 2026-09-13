-- ============================================================================
-- 20260913140000_email_platform.sql
-- ----------------------------------------------------------------------------
-- Slice 1 — Email Platform spine (Purchase → Provision → Active).
--
-- Additive-only, mirrors the project conventions:
--   * plural snake_case tables, uuid PKs, text + CHECK statuses
--   * RLS enabled with NO client policies (service-role only, via supabase-admin)
--   * shared set_updated_at() triggers
--   * reuses orders/payments/subscriptions/provisioning_jobs (no duplication)
--
-- New entities:
--   email_services        — a purchased email service bound to one domain
--   email_mailboxes       — mailboxes of a service (NO passwords stored)
--   email_dns_configs     — MX/SPF/DKIM/DMARC per-service state (Slice 4)
--   email_usage           — storage/mailbox usage snapshots (Slice 5)
--   email_activity_logs   — auditable lifecycle trail
--
-- Also widens provisioning_jobs.kind to 'email' and teaches the shared
-- materialization helpers (complete_checkout / settle_pending_order /
-- __materialize_paid_order) to create email services + jobs on settlement.
-- ============================================================================

-- ============================================================================
-- 1. PROVISIONING JOBS — add 'email' kind
-- ============================================================================

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.provisioning_jobs'::regclass
    and contype = 'c'
    and (conname = 'provisioning_jobs_kind_check'
         or pg_get_constraintdef(oid) like '%kind in (%')
  limit 1;

  if cname is not null then
    execute format('alter table public.provisioning_jobs drop constraint %I', cname);
  end if;
end $$;

alter table public.provisioning_jobs add constraint provisioning_jobs_kind_check
  check (kind in ('hosting', 'domain', 'email'));

create index if not exists provisioning_jobs_kind_status_idx
  on public.provisioning_jobs (kind, status);

-- ============================================================================
-- 2. EMAIL SERVICES — one row per purchased service, bound to a domain
-- ============================================================================

create table if not exists public.email_services (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid,                          -- auth.users.id (profiles.id)
  catalog_product_id  text,                          -- catalog_products.id (text) — no FK, products can change
  order_id            uuid references public.orders (id) on delete set null,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  provider_id         uuid references public.providers (id) on delete set null,
  provider_resource_id uuid references public.provider_resources (id) on delete set null,
  provider_email_id   text,                          -- external service id at the provider
  domain              text not null,
  plan_name           text not null default 'Email',
  plan_period         text not null default 'month'
                      check (plan_period in ('month', 'quarter', 'semiannual', 'year')),
  mailbox_limit       integer not null default 5 check (mailbox_limit >= 0),
  storage_limit_gb    numeric(10,2) not null default 5 check (storage_limit_gb >= 0),
  status              text not null default 'provisioning'
                      check (status in ('provisioning', 'active', 'suspended',
                                        'cancelling', 'cancelled', 'terminated',
                                        'error', 'action_required')),
  provider_status     text,
  dns_status          text not null default 'pending'
                      check (dns_status in ('none', 'pending', 'verifying', 'verified', 'failed', 'external')),
  expires_at          timestamptz,
  meta                jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists email_services_customer_idx  on public.email_services (customer_id, status);
create index if not exists email_services_domain_idx    on public.email_services (domain);
create index if not exists email_services_status_idx    on public.email_services (status, created_at desc);
create index if not exists email_services_subscription_idx on public.email_services (subscription_id);

drop trigger if exists email_services_set_updated_at on public.email_services;
create trigger email_services_set_updated_at
  before update on public.email_services
  for each row execute procedure public.set_updated_at();

alter table public.email_services enable row level security;

-- ============================================================================
-- 3. EMAIL MAILBOXES — NEVER store passwords or anything secret.
-- ============================================================================

create table if not exists public.email_mailboxes (
  id                 uuid primary key default gen_random_uuid(),
  email_service_id   uuid not null references public.email_services (id) on delete cascade,
  provider_mailbox_id text,
  email_address      text not null,
  display_name       text,
  status             text not null default 'provisioning'
                     check (status in ('provisioning', 'active', 'suspended', 'full',
                                       'disabled', 'error', 'deleted')),
  storage_limit_gb   numeric(10,2) not null default 5 check (storage_limit_gb >= 0),
  storage_used_gb    numeric(12,4) not null default 0 check (storage_used_gb >= 0),
  quota_percent      integer not null default 0 check (quota_percent between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  accessed_at        timestamptz,
  meta               jsonb
);

create index if not exists email_mailboxes_service_idx on public.email_mailboxes (email_service_id);
create index if not exists email_mailboxes_status_idx  on public.email_mailboxes (status);
create unique index if not exists email_mailboxes_address_idx on public.email_mailboxes (lower(email_address))
  where status <> 'deleted';

drop trigger if exists email_mailboxes_set_updated_at on public.email_mailboxes;
create trigger email_mailboxes_set_updated_at
  before update on public.email_mailboxes
  for each row execute procedure public.set_updated_at();

alter table public.email_mailboxes enable row level security;

-- ============================================================================
-- 4. EMAIL DNS CONFIG — per-record type state for MX/SPF/DKIM/DMARC (Slice 4)
-- ============================================================================

create table if not exists public.email_dns_configs (
  id               uuid primary key default gen_random_uuid(),
  email_service_id uuid not null references public.email_services (id) on delete cascade,
  record_type      text not null
                   check (record_type in ('mx', 'spf', 'dkim', 'dmarc', 'autodiscover', 'autoconfig')),
  status           text not null default 'pending'
                   check (status in ('pending', 'configured', 'verifying', 'verified', 'failed', 'external')),
  value            jsonb,          -- record payload (host/value/priority)
  selector         text,           -- DKIM selector when applicable
  last_checked_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  meta             jsonb
);

create index if not exists email_dns_configs_service_idx on public.email_dns_configs (email_service_id);
create unique index if not exists email_dns_configs_unique on public.email_dns_configs (email_service_id, record_type);

drop trigger if exists email_dns_configs_set_updated_at on public.email_dns_configs;
create trigger email_dns_configs_set_updated_at
  before update on public.email_dns_configs
  for each row execute procedure public.set_updated_at();

alter table public.email_dns_configs enable row level security;

-- ============================================================================
-- 5. EMAIL USAGE — storage / mailbox snapshots (Slice 5)
-- ============================================================================

create table if not exists public.email_usage (
  id                 uuid primary key default gen_random_uuid(),
  email_service_id   uuid not null references public.email_services (id) on delete cascade,
  storage_used_gb    numeric(12,4) not null default 0 check (storage_used_gb >= 0),
  storage_limit_gb   numeric(10,2) not null default 0 check (storage_limit_gb >= 0),
  mailboxes_used     integer not null default 0 check (mailboxes_used >= 0),
  mailboxes_limit    integer not null default 0 check (mailboxes_limit >= 0),
  recorded_at        timestamptz not null default now(),
  meta               jsonb
);

create index if not exists email_usage_service_idx on public.email_usage (email_service_id, recorded_at desc);

alter table public.email_usage enable row level security;

-- ============================================================================
-- 6. EMAIL ACTIVITY LOG — auditable, no passwords / sensitive content
-- ============================================================================

create table if not exists public.email_activity_logs (
  id               uuid primary key default gen_random_uuid(),
  email_service_id uuid references public.email_services (id) on delete cascade,
  mailbox_id       uuid references public.email_mailboxes (id) on delete set null,
  actor            text,           -- 'customer', 'system', 'admin', user id
  action           text not null,
  details          jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists email_activity_logs_service_idx on public.email_activity_logs (email_service_id, created_at desc);
create index if not exists email_activity_logs_action_idx  on public.email_activity_logs (action, created_at desc);

alter table public.email_activity_logs enable row level security;

-- ============================================================================
-- 7. SHARED MATERIALIZATION HELPER — now also creates email services
-- ============================================================================

create or replace function public.__materialize_paid_order(
  p_order_id uuid,
  p_domains  jsonb default '[]'::jsonb,
  p_subs     jsonb default '[]'::jsonb,
  p_email    jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dom        jsonb;
  v_existing   text;
  v_domain_id  uuid;
  v_sub        jsonb;
  v_sub_id     uuid;
  v_host       jsonb;
  v_host_id    uuid;
  v_email      jsonb;
  v_email_id   uuid;
  v_subs       jsonb := '[]'::jsonb;
  v_emails     jsonb := '[]'::jsonb;
  v_has_jobs   boolean := false;
begin
  -- DOMAIN REGISTRATIONS ------------------------------------------------
  for v_dom in select * from jsonb_array_elements(p_domains) loop
    select status into v_existing
      from public.domains where full_domain = v_dom->>'full_domain' limit 1;

    v_domain_id := null;
    if v_existing is null then
      insert into public.domains
        (name, extension, full_domain, status, price, order_id, customer_id)
      values (
        v_dom->>'name',
        v_dom->>'extension',
        v_dom->>'full_domain',
        'pending',
        (v_dom->>'price')::numeric,
        p_order_id,
        nullif(v_dom->>'customer_id', '')::uuid
      )
      returning id into v_domain_id;
      v_has_jobs := true;
    elsif v_existing not in ('registered', 'reserved') then
      update public.domains
         set status = 'pending',
             price = (v_dom->>'price')::numeric,
             order_id = p_order_id,
             updated_at = now()
       where full_domain = v_dom->>'full_domain'
      returning id into v_domain_id;
      v_has_jobs := true;
    end if;

    insert into public.domain_orders
      (full_domain, name, extension, email, price, status, customer_id)
    values (
      v_dom->>'full_domain',
      v_dom->>'name',
      v_dom->>'extension',
      coalesce(v_dom->>'email', ''),
      (v_dom->>'price')::numeric,
      'paid',
      nullif(v_dom->>'customer_id', '')::uuid
    );

    if v_domain_id is not null then
      insert into public.provisioning_jobs (order_id, kind, ref_id)
      values (p_order_id, 'domain', v_domain_id);
    end if;
  end loop;

  -- SUBSCRIPTIONS (+ optional hosting accounts + jobs) ------------------
  for v_sub in select * from jsonb_array_elements(p_subs) loop
    insert into public.subscriptions
      (customer_id, organization_id, kind, plan_id, period, price, currency,
       status, starts_at, renews_at, auto_renew, payment_method)
    values (
      nullif(v_sub->>'customer_id', '')::uuid,
      nullif(v_sub->>'organization_id', '')::uuid,
      v_sub->>'kind',
      nullif(v_sub->>'plan_id', '')::uuid,
      v_sub->>'period',
      (v_sub->>'price')::numeric,
      coalesce(v_sub->>'currency', 'MZN'),
      'active',
      now(),
      nullif(v_sub->>'renews_at', '')::timestamptz,
      coalesce((v_sub->>'auto_renew')::boolean, true),
      v_sub->>'payment_method'
    )
    returning id into v_sub_id;

    v_subs := v_subs || jsonb_build_object(
      'id', v_sub_id,
      'kind', v_sub->>'kind',
      'period', v_sub->>'period',
      'price', (v_sub->>'price')::numeric,
      'currency', coalesce(v_sub->>'currency', 'MZN'),
      'renews_at', v_sub->>'renews_at'
    );

    if (v_sub ? 'hosting') and v_sub->'hosting' is not null and v_sub->'hosting' <> 'null'::jsonb then
      v_host := v_sub->'hosting';
      insert into public.hosting_accounts
        (customer_id, organization_id, plan_id, domain, status, quota_gb,
         order_id, subscription_id, renews_at)
      values (
        nullif(v_sub->>'customer_id', '')::uuid,
        nullif(v_sub->>'organization_id', '')::uuid,
        nullif(v_host->>'plan_id', '')::uuid,
        v_host->>'domain',
        'pending',
        coalesce((v_host->>'quota_gb')::int, 0),
        p_order_id,
        v_sub_id,
        nullif(v_sub->>'renews_at', '')::timestamptz
      )
      returning id into v_host_id;

      insert into public.provisioning_jobs (order_id, kind, ref_id)
      values (p_order_id, 'hosting', v_host_id);
      v_has_jobs := true;
    end if;
  end loop;

  -- EMAIL SERVICES ------------------------------------------------------
  for v_email in select * from jsonb_array_elements(p_email) loop
    insert into public.email_services
      (customer_id, catalog_product_id, order_id, domain, plan_name, plan_period,
       mailbox_limit, storage_limit_gb, status, dns_status, expires_at, meta)
    values (
      nullif(v_email->>'customer_id', '')::uuid,
      nullif(v_email->>'catalog_product_id', ''),
      p_order_id,
      lower(v_email->>'domain'),
      coalesce(nullif(v_email->>'plan_name', ''), 'Email'),
      coalesce(nullif(v_email->>'period', ''), 'month'),
      coalesce((v_email->>'mailbox_limit')::int, 5),
      coalesce((v_email->>'storage_limit_gb')::numeric, 5),
      'provisioning',
      coalesce(nullif(v_email->>'dns_status', ''), 'pending'),
      nullif(v_email->>'expires_at', '')::timestamptz,
      v_email->'meta'
    )
    returning id into v_email_id;

    insert into public.provisioning_jobs (order_id, kind, ref_id)
    values (p_order_id, 'email', v_email_id);
    v_has_jobs := true;

    v_emails := v_emails || jsonb_build_object(
      'id', v_email_id,
      'domain', v_email->>'domain',
      'status', 'provisioning'
    );
  end loop;

  return jsonb_build_object(
    'has_jobs', v_has_jobs,
    'subscriptions', v_subs,
    'emails', v_emails
  );
end;
$$;

revoke all on function public.__materialize_paid_order(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.__materialize_paid_order(uuid, jsonb, jsonb, jsonb)
  to service_role;

-- ============================================================================
-- 8. complete_checkout — instant path, now accepts email plans
-- ============================================================================

create or replace function public.complete_checkout(
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb,
  p_domains jsonb default '[]'::jsonb,
  p_subs jsonb default '[]'::jsonb,
  p_email jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id     uuid;
  v_order_status text := 'paid';
  v_coupon_id    uuid;
  v_item         jsonb;
  v_material     jsonb;
begin
  insert into public.orders
    (id, number, customer_id, organization_id, status, subtotal, discount_amount,
     tax_rate, tax_amount, total, currency, coupon_id, notes)
  values (
    gen_random_uuid(),
    p_order->>'number',
    nullif(p_order->>'customer_id', '')::uuid,
    nullif(p_order->>'organization_id', '')::uuid,
    p_order->>'status',
    (p_order->>'subtotal')::numeric,
    coalesce((p_order->>'discount_amount')::numeric, 0),
    coalesce((p_order->>'tax_rate')::numeric, 0),
    coalesce((p_order->>'tax_amount')::numeric, 0),
    coalesce((p_order->>'total')::numeric, coalesce((p_order->>'subtotal')::numeric, 0)),
    coalesce(p_order->>'currency', 'MZN'),
    nullif(p_order->>'coupon_id', '')::uuid,
    nullif(p_order->>'notes', '')
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items
      (order_id, kind, label, description, qty, unit_price, line_total, meta, status)
    values (
      v_order_id,
      v_item->>'kind',
      v_item->>'label',
      v_item->>'description',
      coalesce((v_item->>'qty')::int, 1),
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric,
      v_item->'meta',
      'active'
    );
  end loop;

  insert into public.payments
    (order_id, customer_id, method, reference, amount, currency, status, paid_at, meta)
  values (
    v_order_id,
    nullif(p_payment->>'customer_id', '')::uuid,
    p_payment->>'method',
    p_payment->>'reference',
    (p_payment->>'amount')::numeric,
    coalesce(p_payment->>'currency', 'MZN'),
    'paid',
    now(),
    p_payment->'meta'
  );

  v_material := public.__materialize_paid_order(v_order_id, p_domains, p_subs, p_email);

  if (v_material->>'has_jobs')::boolean then
    update public.orders set status = 'processing', updated_at = now() where id = v_order_id;
    v_order_status := 'processing';
  end if;

  if nullif(p_order->>'coupon_id', '') is not null then
    v_coupon_id := (p_order->>'coupon_id')::uuid;
    update public.coupons set used_count = used_count + 1 where id = v_coupon_id;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'number', p_order->>'number',
    'status', v_order_status,
    'pending', (v_material->>'has_jobs')::boolean,
    'subscriptions', v_material->'subscriptions',
    'emails', v_material->'emails'
  );
end;
$$;

revoke all on function public.complete_checkout(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_checkout(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;

-- ============================================================================
-- 9. create_pending_checkout — unchanged (email materializes at settlement)
-- ============================================================================

-- (kept from 20260913130000_billing_engine.sql — no changes needed)

-- ============================================================================
-- 10. settle_pending_order — now also materializes email services
-- ============================================================================

create or replace function public.settle_pending_order(
  p_order_id   uuid,
  p_payment_id uuid,
  p_domains    jsonb default '[]'::jsonb,
  p_subs       jsonb default '[]'::jsonb,
  p_email      jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_status text;
  v_order_status   text;
  v_final_status   text;
  v_coupon_id      uuid;
  v_material       jsonb;
  v_order_number   text;
begin
  select status into v_payment_status
    from public.payments where id = p_payment_id for update;
  if v_payment_status is null then
    return jsonb_build_object('ok', false, 'error', 'Pagamento não encontrado.');
  end if;

  select status, coupon_id, number into v_order_status, v_coupon_id, v_order_number
    from public.orders where id = p_order_id;
  if v_order_status is null then
    return jsonb_build_object('ok', false, 'error', 'Encomenda não encontrada.');
  end if;

  if v_payment_status = 'paid' then
    return jsonb_build_object(
      'ok', true, 'already', true,
      'order_id', p_order_id, 'payment_id', p_payment_id,
      'number', v_order_number,
      'status', v_order_status,
      'pending', false,
      'subscriptions', '[]'::jsonb,
      'emails', '[]'::jsonb
    );
  end if;

  if v_payment_status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Pagamento já processado.');
  end if;

  update public.payments
     set status = 'paid', paid_at = now(), updated_at = now()
   where id = p_payment_id;

  update public.orders
     set status = 'paid', updated_at = now()
   where id = p_order_id;

  v_material := public.__materialize_paid_order(p_order_id, p_domains, p_subs, p_email);

  if (v_material->>'has_jobs')::boolean then
    update public.orders set status = 'processing', updated_at = now() where id = p_order_id;
    v_final_status := 'processing';
  else
    v_final_status := 'paid';
  end if;

  if v_coupon_id is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon_id;
  end if;

  return jsonb_build_object(
    'ok', true, 'already', false,
    'order_id', p_order_id,
    'payment_id', p_payment_id,
    'number', v_order_number,
    'status', v_final_status,
    'pending', (v_material->>'has_jobs')::boolean,
    'subscriptions', v_material->'subscriptions',
    'emails', v_material->'emails'
  );
end;
$$;

revoke all on function public.settle_pending_order(uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_pending_order(uuid, uuid, jsonb, jsonb, jsonb)
  to service_role;