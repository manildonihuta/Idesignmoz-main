-- ----------------------------------------------------------------------
-- IDesign Moz - security audit trail
-- audit_logs (append-only business event log, written via logAudit)
-- ----------------------------------------------------------------------

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,                 -- e.g. 'contact.created', 'profile.role'
  entity      text not null,                 -- e.g. 'contact_message', 'proposal'
  entity_id   text,                          -- primary key of the affected row
  actor_id    uuid,                          -- auth.users id of the actor
  actor_email text,
  actor_role  text,                          -- rbac role at the time of the action
  ip          text,
  meta        jsonb,                         -- free-form action-specific context
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_action_idx   on public.audit_logs (action);
create index if not exists audit_logs_entity_idx   on public.audit_logs (entity, entity_id);
create index if not exists audit_logs_created_idx  on public.audit_logs (created_at desc);

-- Written exclusively with the service-role key (bypasses RLS); leave RLS
-- disabled so service-role writes are always allowed.