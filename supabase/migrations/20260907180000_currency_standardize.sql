-- Standardize currency codes to ISO 'MZN' and add `currency` to the
-- money-bearing tables that still lacked it. Also widen proposal money
-- columns from integer to numeric(12,2).

-- hosting_plans currently defaults currency to 'MT' — switch to ISO 'MZN'.
alter table public.hosting_plans alter column currency set default 'MZN';

-- Domain price catalogue + ownership + orders: record the currency of the price.
alter table public.domain_extensions add column if not exists currency text not null default 'MZN';
alter table public.domain_extensions alter column registration type numeric(12,2);
alter table public.domain_extensions alter column renewal     type numeric(12,2);
alter table public.domains        add column if not exists currency text not null default 'MZN';
alter table public.domains        alter column price type numeric(12,2);
alter table public.domain_orders  add column if not exists currency text not null default 'MZN';
alter table public.domain_orders  alter column price type numeric(12,2);

-- Proposals: money as decimal, plus a currency column.
alter table public.proposals add column if not exists currency text not null default 'MZN';
alter table public.proposals alter column subtotal         type numeric(12,2);
alter table public.proposals alter column discount_amount  type numeric(12,2);
alter table public.proposals alter column tax_amount       type numeric(12,2);
alter table public.proposals alter column total            type numeric(12,2);
alter table public.proposals alter column tax_rate         type numeric(5,2);

alter table public.proposal_items add column if not exists currency text not null default 'MZN';
alter table public.proposal_items alter column unit_price type numeric(12,2);
alter table public.proposal_items alter column line_total type numeric(12,2);

-- Project budgets carry an optional currency (default MZN).
alter table public.projects add column if not exists currency text not null default 'MZN';
