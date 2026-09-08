-- ----------------------------------------------------------------------
-- IDesign Moz — hosting billing: billing cycles + lifecycle states
--
-- Subscriptions support 4 billing cycles: month, quarter, semiannual, year.
-- Lifecycle when a cycle expires (renews_at passes):
--   active -> past_due -> suspended -> terminated
--   (auto_renew = true re-extends renews_at and stays active)
-- ----------------------------------------------------------------------

-- 1. SUBSCRIPTIONS — expand period + status + lifecycle timestamps
alter table public.subscriptions drop constraint if exists subscriptions_period_check;
alter table public.subscriptions add constraint subscriptions_period_check
  check (period in ('month', 'quarter', 'semiannual', 'year'));

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'past_due', 'suspended', 'terminated', 'paused', 'cancelled', 'expired'));

alter table public.subscriptions add column if not exists past_due_since   timestamptz;
alter table public.subscriptions add column if not exists suspended_since   timestamptz;

-- 2. HOSTING PLANS — per-cycle price catalogue (never derived at runtime)
alter table public.hosting_plans add column if not exists price_quarterly   numeric(12,2);
alter table public.hosting_plans add column if not exists price_semiannual   numeric(12,2);

-- Backfill new cycles from the monthly price where unset (one-time data fix).
update public.hosting_plans
   set price_quarterly = coalesce(price_quarterly, price_monthly * 3),
       price_semiannual = coalesce(price_semiannual, price_monthly * 6);

alter table public.hosting_plans alter column price_quarterly set default 0;
alter table public.hosting_plans alter column price_semiannual set default 0;
alter table public.hosting_plans alter column price_quarterly set not null;
alter table public.hosting_plans alter column price_semiannual set not null;

-- 3. HOSTING ACCOUNTS — mirror the subscription lifecycle ('terminated')
alter table public.hosting_accounts drop constraint if exists hosting_accounts_status_check;
alter table public.hosting_accounts add constraint hosting_accounts_status_check
  check (status in ('pending', 'active', 'suspended', 'terminated', 'cancelled'));