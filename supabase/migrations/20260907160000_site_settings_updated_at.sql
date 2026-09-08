-- Keep updated_at fresh on site_settings upserts.

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_site_settings_updated_at();

alter table public.site_settings owner to postgres;
alter table public.site_settings enable row level security;
