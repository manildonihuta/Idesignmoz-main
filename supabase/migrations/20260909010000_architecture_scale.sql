-- ============================================================================
-- IDesign Moz — Architecture scaling
-- ----------------------------------------------------------------------------
-- 1. P2  : indexes for cron scans and admin lists (thousands of rows)
-- 2. P4  : relational buyable catalog (catalog_products table, seeded with
--          the current site_settings.catalog_products JSON) so products scale
--          to thousands with queryability, integrity and admin management.
-- 3. P3  : complete_checkout() RPC — creates order/items/payment/subscriptions/
--          hosting/domains/jobs ATOMICALLY in one transaction (no orphans).
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 1. INDEXES (hot paths that grow with thousands of rows)
-- ============================================================================

-- Billing lifecycle cron scans subscriptions by (status, renews_at).
create index if not exists subscriptions_status_renews_idx
  on public.subscriptions (status, renews_at);

-- Domain expiration cron scans by expires_at.
create index if not exists domains_expires_at_idx
  on public.domains (expires_at);

-- Admin lists order / payments by recency and by status.
create index if not exists orders_created_at_idx        on public.orders (created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists payments_created_at_idx      on public.payments (created_at desc);
create index if not exists payments_paid_at_idx         on public.payments (paid_at);

-- ============================================================================
-- 2. RELATIONAL CATALOG (P4) — buyable products, queryable + admin-manageable
-- ============================================================================

create table if not exists public.catalog_products (
  id           text primary key,                     -- e.g. 'hosting-shared-business'
  name         text not null,
  category     text not null
               check (category in ('domain', 'hosting', 'email', 'website', 'branding', 'software', 'design', 'seo', 'marketing', 'maintenance')),
  type         text not null check (type in ('one_time', 'recurring')),
  price        bigint not null check (price > 0),    -- integer minor units (MZN)
  annual_price bigint,                                -- recurring annual price (minor units)
  currency     text not null default 'MZN',
  description  text not null default '',
  features     text[] not null default '{}',
  href         text not null default '',
  icon         text,
  meta         jsonb,
  for_services text[] not null default '{}',
  for_pricing  text[] not null default '{}',
  active       boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists catalog_products_category_idx on public.catalog_products (category);
create index if not exists catalog_products_active_idx   on public.catalog_products (active);

alter table public.catalog_products enable row level security;

-- Prices are public (same as domain_extensions) — anyone may read.
create policy "anyone can read catalog products"
  on public.catalog_products for select using (true);

-- Backfill the buyable catalog from the existing site_settings JSON blob when
-- running over an already-seeded database (idempotent: only if table empty).
do $$
declare
  v_site jsonb;
  v_row  jsonb;
  v_feat text[];
  v_svc  text[];
  v_price text[];
begin
  select value into v_site from public.site_settings where key = 'catalog_products' limit 1;
  if v_site is not null and not exists (select 1 from public.catalog_products limit 1) then
    for v_row in select * from jsonb_array_elements(v_site) loop
      select array(select jsonb_array_elements_text(v_row->'features')) into v_feat;
      select array(select jsonb_array_elements_text(v_row->'for_services')) into v_svc;
      select array(select jsonb_array_elements_text(v_row->'for_pricing')) into v_price;
      insert into public.catalog_products
        (id, name, category, type, price, annual_price, currency, description,
         features, href, icon, meta, for_services, for_pricing, active, sort)
      values (
        v_row->>'id',
        v_row->>'name',
        v_row->>'category',
        v_row->>'type',
        (v_row->>'price')::bigint,
        nullif(v_row->>'annualPrice', '')::bigint,
        coalesce(v_row->>'currency', 'MZN'),
        coalesce(v_row->>'description', ''),
        coalesce(v_feat, '{}'),
        coalesce(v_row->>'href', ''),
        v_row->>'icon',
        v_row->'meta',
        coalesce(v_svc, '{}'),
        coalesce(v_price, '{}'),
        true,
        0
      );
    end loop;
  end if;
end $$;

-- Keep updated_at fresh for admin edits.
drop trigger if exists catalog_products_set_updated_at on public.catalog_products;
create trigger catalog_products_set_updated_at
  before update on public.catalog_products
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- 3. ATOMIC CHECKOUT (P3) — one transaction, zero orphan rows
-- ----------------------------------------------------------------------------
-- Receives fully-validated, fully-priced payloads from the application layer
-- (pricing/validation stays in TypeScript; this RPC only writes). Any failure
-- rolls back the entire checkout. Returns created ids for post-commit
-- side-effects (audit + notifications) which run in the route after success.
-- Service-role only (RLS bypassed by design; revoked from anon/authenticated).
-- ============================================================================

create or replace function public.complete_checkout(
  p_order jsonb,      -- {number, customer_id, organization_id, status, subtotal, total, currency, notes}
  p_items jsonb,      -- [{kind, label, description, qty, unit_price, line_total, meta}]
  p_payment jsonb,    -- {customer_id, method, reference, amount, currency, meta}
  p_domains jsonb,    -- [{name, extension, full_domain, price, email, customer_id}] — registration items
  p_subs jsonb        -- [{customer_id, organization_id, kind, plan_id, period, price, currency, renews_at, auto_renew, payment_method, hosting: {plan_id, domain, quota_gb}?}]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_order_status text := 'paid';
  v_has_jobs   boolean := false;
  v_item       jsonb;
  v_dom        jsonb;
  v_existing   text;
  v_domain_id  uuid;
  v_sub        jsonb;
  v_sub_id     uuid;
  v_host       jsonb;
  v_host_id    uuid;
  v_subs       jsonb := '[]'::jsonb;
begin
  -- 1. ORDER -----------------------------------------------------------------
  insert into public.orders
    (id, number, customer_id, organization_id, status, subtotal, discount_amount,
     tax_rate, tax_amount, total, currency, notes)
  values (
    gen_random_uuid(),
    p_order->>'number',
    nullif(p_order->>'customer_id', '')::uuid,
    nullif(p_order->>'organization_id', '')::uuid,
    p_order->>'status',
    (p_order->>'subtotal')::numeric,
    0,
    coalesce((p_order->>'tax_rate')::numeric, 0),
    coalesce((p_order->>'tax_amount')::numeric, 0),
    (p_order->>'total')::numeric,
    coalesce(p_order->>'currency', 'MZN'),
    nullif(p_order->>'notes', '')
  )
  returning id into v_order_id;

  -- 2. ORDER ITEMS -----------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items
      (order_id, kind, label, description, qty, unit_price, line_total, meta)
    values (
      v_order_id,
      v_item->>'kind',
      v_item->>'label',
      v_item->>'description',
      coalesce((v_item->>'qty')::int, 1),
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric,
      v_item->'meta'
    );
  end loop;

  -- 3. PAYMENT ---------------------------------------------------------------
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

  -- 4. DOMAIN REGISTRATIONS (domains row + order row + provisioning job) ------
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
        v_order_id,
        nullif(v_dom->>'customer_id', '')::uuid
      )
      returning id into v_domain_id;
      v_has_jobs := true;
    elsif v_existing not in ('registered', 'reserved') then
      update public.domains
         set status = 'pending',
             price = (v_dom->>'price')::numeric,
             order_id = v_order_id,
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
      values (v_order_id, 'domain', v_domain_id);
    end if;
  end loop;

  -- 5. SUBSCRIPTIONS (+ optional hosting_accounts + provisioning jobs) --------
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
        v_order_id,
        v_sub_id,
        nullif(v_sub->>'renews_at', '')::timestamptz
      )
      returning id into v_host_id;

      insert into public.provisioning_jobs (order_id, kind, ref_id)
      values (v_order_id, 'hosting', v_host_id);
      v_has_jobs := true;
    end if;
  end loop;

  -- 6. ORDER STATUS: 'processing' when provisioning was queued ----------------
  if v_has_jobs then
    update public.orders set status = 'processing', updated_at = now() where id = v_order_id;
    v_order_status := 'processing';
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'number', p_order->>'number',
    'status', v_order_status,
    'pending', v_has_jobs,
    'subscriptions', v_subs
  );
end;
$$;

-- Expose the checkout RPC to the server only.
revoke all on function public.complete_checkout(jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_checkout(jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;