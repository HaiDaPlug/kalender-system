-- Add 'unknown' to sms_logs status for cases where delivery is ambiguous
-- (process died after sending but before the log was updated)
alter table sms_logs drop constraint if exists sms_logs_status_check;
alter table sms_logs add constraint sms_logs_status_check
  check (status in ('pending', 'sent', 'delivered', 'failed', 'unknown'));

create table if not exists sms_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  body       text not null,
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active template
create unique index if not exists sms_templates_single_active_idx
  on sms_templates (is_active)
  where is_active = true;

alter table sms_templates enable row level security;

create policy "sms_templates_select" on sms_templates for select
  using (auth.uid() is not null);

create policy "sms_templates_update" on sms_templates for update
  using (private.current_user_has_role(array['admin']))
  with check (private.current_user_has_role(array['admin']));

insert into sms_templates (name, body, is_active)
values (
  'Bokningsbekräftelse',
  'Hej {name}, din bokning för {service} är bekräftad den {date} kl {time}. Välkommen!',
  true
)
on conflict (name) do nothing;
