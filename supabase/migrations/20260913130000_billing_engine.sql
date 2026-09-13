-- ============================================================================
-- IDesign Moz — Billing & payment money-flow (phase 2)
-- ----------------------------------------------------------------------------
-- Adds the money-flow core behind the billing engine:
--   1. payments: provider fields (provider_transaction_id, idempotency_key,
--      error_message, attempts) + method widened to all provider ids +
--      partially_refunded status.
--   2. orders: + partially_active status.
--   3. order_items: + per-item fulfillment status.
--   4. payment_proofs : manual evidence for M-Pesa/e-Mola/mKesh/bank transfers.
--   5. refunds        : request/approve/process/reject with provider ref.
--   6. credit_ledger  : customer credits (+ top-ups, − applications).
--   7. RPC refactor: complete_checkout honours discount/coupon/tax; new
--      create_pending_checkout (async/manual payments) and
--      settle_pending_order (admin/proof-driven settlement) reuse the same
--      materialization helper so there is a single source of truth.
--
-- All additive + idempotent. Service-role only (new tables have RLS enabled
-- with no policies — service_role bypasses RLS by design).
-- ============================================================================

-- ============================================================================
-- 1. PAYMENTS — provider fields + method/status widening
-- ============================================================================

alter table public.payments
  add column if not exists provider_transaction_id text,
  add column if not exists idempotency_key         text,
  add column if not exists error_message           text,
  add column if not exists attempts                integer not null default 0;

create unique index if not exists payments_idempotency_key_idx
  on public.payments (idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_reference_idx  on public.payments (reference);
create index if not exists payments_status_created_idx on public.payments (status, created_at desc);

-- Method: widen to every registered provider id (plus legacy aliases).
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.payments'::regclass
    and contype = 'c'
    and (conname = 'payments_method_check'
         or pg_get_constraintdef(oid) like '%method in (%')
  limit 1;

  if cname is not null then
    execute format('alter table public.payments drop constraint %I', cname);
  end if;
end $$;

alter table public.payments add constraint payments_method_check
  check (method in ('mpesa', 'emola', 'mkesh', 'visa', 'mastercard', 'bank-transfer', 'card', 'bank_transfer', 'cash'));

-- Status: + partially_refunded (partial refunds keep the payment visible).
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.payments'::regclass
    and contype = 'c'
    and (conname = 'payments_status_check'
         or pg_get_constraintdef(oid) like '%status in (%')
  limit 1;

  if cname is not null then
    execute format('alter table public.payments drop constraint %I', cname);
  end if;
end $$;

alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

-- ============================================================================
-- 2. ORDERS — + partially_active + coupon index
-- ============================================================================

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.orders'::regclass
    and contype = 'c'
    and (conname = 'orders_status_check'
         or pg_get_constraintdef(oid) like '%status in (%')
  limit 1;

  if cname is not null then
    execute format('alter table public.orders drop constraint %I', cname);
  end if;
end $$;

alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'processing', 'completed', 'partially_active', 'cancelled', 'refunded'));

create index if not exists orders_coupon_idx on public.orders (coupon_id);

-- ============================================================================
-- 3. ORDER ITEMS — per-item fulfillment status
-- ============================================================================

alter table public.order_items add column if not exists status text not null default 'active'
  check (status in ('pending', 'provisioning', 'active', 'failed', 'cancelled'));

create index if not exists order_items_order_status_idx on public.order_items (order_id, status);

-- ============================================================================
-- 4. PAYMENT PROOFS — manual payment evidence (file stored in R2/S3)
-- ============================================================================

create table if not exists public.payment_proofs (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid references public.payments (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  file_key    text not null,
  file_url    text not null,
  mime        text,
  size_bytes  integer not null default 0,
  notes       text,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists payment_proofs_payment_idx  on public.payment_proofs (payment_id);
create index if not exists payment_proofs_status_idx   on public.payment_proofs (status, created_at desc);
create index if not exists payment_proofs_customer_idx on public.payment_proofs (customer_id);

alter table public.payments
  add column if not exists proof_id uuid references public.payment_proofs (id) on delete set null;

alter table public.payment_proofs enable row level security;

-- ============================================================================
-- 5. REFUNDS
-- ============================================================================

create table if not exists public.refunds (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid references public.payments (id) on delete set null,
  order_id     uuid references public.orders (id) on delete set null,
  customer_id  uuid references public.customers (id) on delete set null,
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null default 'MZN',
  reason       text not null,
  method       text,               -- how the money returns to the customer
  status       text not null default 'requested'
               check (status in ('requested', 'approved', 'processed', 'rejected')),
  provider_ref text,
  notes        text,
  requested_by uuid references auth.users (id) on delete set null,
  reviewed_by  uuid references auth.users (id) on delete set null,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists refunds_payment_idx     on public.refunds (payment_id);
create index if not exists refunds_order_idx       on public.refunds (order_id);
create index if not exists refunds_customer_idx    on public.refunds (customer_id);
create index if not exists refunds_status_idx      on public.refunds (status, created_at desc);

drop trigger if exists refunds_set_updated_at on public.refunds;
create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute procedure public.set_updated_at();

alter table public.refunds enable row level security;

-- ============================================================================
-- 6. CREDIT LEDGER — customer credits (+ top-up, − applied to an order)
-- ============================================================================

create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  order_id    uuid references public.orders (id) on delete set null,
  refund_id   uuid references public.refunds (id) on delete set null,
  amount      numeric(12,2) not null check (amount <> 0),
  reason      text not null,
  balance_after numeric(12,2) not null,
  meta        jsonb,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists credit_ledger_customer_idx on public.credit_ledger (customer_id);
create index if not exists credit_ledger_order_idx    on public.credit_ledger (order_id);
create index if not exists credit_ledger_created_idx  on public.credit_ledger (customer_id, created_at desc);

alter table public.credit_ledger enable row level security;

-- ============================================================================
-- 7. SHARED MATERIALIZATION HELPER
-- ----------------------------------------------------------------------------
-- Takes an order that is ALREADY paid and materializes the recurring
-- subscriptions (+hosting accounts), domain registrations, provisioning jobs
-- and the per-item statuses. Single source of truth for both the instant
-- checkout path (complete_checkout) and the manual/proof settlement path
-- (settle_pending_order). Service-role only.
-- ============================================================================

create or replace function public.__materialize_paid_order(
  p_order_id uuid,
  p_domains jsonb default '[]'::jsonb,
  p_subs    jsonb default '[]'::jsonb
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
  v_subs       jsonb := '[]'::jsonb;
  v_has_jobs   boolean := false;
begin
  -- 4. DOMAIN REGISTRATIONS ---------------------------------------------
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

  -- 5. SUBSCRIPTIONS (+ optional hosting_accounts + provisioning jobs) --
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

  return jsonb_build_object('has_jobs', v_has_jobs, 'subscriptions', v_subs);
end;
$$;

revoke all on function public.__materialize_paid_order(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.__materialize_paid_order(uuid, jsonb, jsonb)
  to service_role;

-- ============================================================================
-- 8. complete_checkout — instant path, now honours discount/coupon/tax
-- ----------------------------------------------------------------------------
-- Same signature + return contract as before; the involved logic now lives in
-- __materialize_paid_order. Coupon usage counted here (order settled at once).
-- ============================================================================

create or replace function public.complete_checkout(
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb,
  p_domains jsonb,
  p_subs jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id    uuid;
  v_order_status text := 'paid';
  v_coupon_id   uuid;
  v_item        jsonb;
  v_material    jsonb;
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

  v_material := public.__materialize_paid_order(v_order_id, p_domains, p_subs);

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
    'subscriptions', v_material->'subscriptions'
  );
end;
$$;

-- ============================================================================
-- 9. create_pending_checkout — manual / proof-first methods
-- ----------------------------------------------------------------------------
-- Creates the order (pending) + items + payment (pending) ONLY. Nothing is
-- materialized until an admin approves the payment proof via
-- settle_pending_order. Coupon usage is counted at settlement, not here.
-- ============================================================================

create or replace function public.create_pending_checkout(
  p_order jsonb,
  p_items jsonb,
  p_payment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_payment_id uuid;
  v_item       jsonb;
begin
  insert into public.orders
    (id, number, customer_id, organization_id, status, subtotal, discount_amount,
     tax_rate, tax_amount, total, currency, coupon_id, notes)
  values (
    gen_random_uuid(),
    p_order->>'number',
    nullif(p_order->>'customer_id', '')::uuid,
    nullif(p_order->>'organization_id', '')::uuid,
    'pending',
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
      'pending'
    );
  end loop;

  insert into public.payments
    (order_id, customer_id, method, reference, amount, currency, status, meta)
  values (
    v_order_id,
    nullif(p_payment->>'customer_id', '')::uuid,
    p_payment->>'method',
    p_payment->>'reference',
    (p_payment->>'amount')::numeric,
    coalesce(p_payment->>'currency', 'MZN'),
    'pending',
    p_payment->'meta'
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'payment_id', v_payment_id,
    'number', p_order->>'number',
    'status', 'pending'
  );
end;
$$;

revoke all on function public.create_pending_checkout(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_pending_checkout(jsonb, jsonb, jsonb)
  to service_role;

-- ============================================================================
-- 10. settle_pending_order — admin/proof-driven settlement
-- ----------------------------------------------------------------------------
-- Marks a pending payment paid and materializes domains/subscriptions/jobs
-- for the pending order (idempotent: only works while the payment is pending).
-- Coupon usage is counted here (the order actually settles now).
-- ============================================================================

create or replace function public.settle_pending_order(
  p_order_id   uuid,
  p_payment_id uuid,
  p_domains    jsonb default '[]'::jsonb,
  p_subs       jsonb default '[]'::jsonb
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
    -- Idempotent replay: already settled.
    return jsonb_build_object(
      'ok', true, 'already', true,
      'order_id', p_order_id, 'payment_id', p_payment_id,
      'number', v_order_number,
      'status', v_order_status,
      'pending', false,
      'subscriptions', '[]'::jsonb
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

  v_material := public.__materialize_paid_order(p_order_id, p_domains, p_subs);

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
    'subscriptions', v_material->'subscriptions'
  );
end;
$$;

revoke all on function public.settle_pending_order(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_pending_order(uuid, uuid, jsonb, jsonb)
  to service_role;