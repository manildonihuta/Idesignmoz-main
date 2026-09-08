-- Widen the payments.method CHECK constraint to accept every
-- PaymentMethodId supported by the storefront (payment-providers.ts):
--   mpesa, emola, mkesh, visa, mastercard, bank-transfer
-- while keeping legacy values (card, bank, cash) intact.

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

alter table public.payments
  add constraint payments_method_check
  check (method in ('mpesa', 'emola', 'mkesh', 'visa', 'mastercard', 'bank-transfer', 'card', 'bank', 'cash'));