-- ---------------------------------------------------------------
-- Fix notifications.recipient_id: runtime identities live in
-- auth.users (profiles.id == auth.users.id), not public.users.
-- Re-point the FK (idempotent).
-- ---------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_recipient_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'f'
      and conname = 'notifications_recipient_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_recipient_id_fkey
      foreign key (recipient_id) references auth.users (id) on delete cascade;
  end if;
end $$;