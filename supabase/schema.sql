-- ============================================================
-- CleanCalendar — Supabase Schema
-- Run this in your Supabase SQL editor to initialize the DB.
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text not null,
  phone        text,
  role         text not null default 'worker' check (role in ('admin', 'manager', 'worker')),
  avatar_url   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'worker')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Customers ─────────────────────────────────────────────────────────────
create table if not exists customers (
  id                     uuid primary key default uuid_generate_v4(),
  full_name              text not null,
  email                  text,
  phone                  text not null,
  address                text,
  notes                  text,
  highlevel_contact_id   text unique,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── Cars ──────────────────────────────────────────────────────────────────
create table if not exists cars (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid not null references customers(id) on delete cascade,
  make          text not null,
  model         text not null,
  year          integer,
  color         text,
  license_plate text,
  vin           text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Bookings ──────────────────────────────────────────────────────────────
create table if not exists bookings (
  id                           uuid primary key default uuid_generate_v4(),
  customer_id                  uuid not null references customers(id),
  car_id                       uuid not null references cars(id),
  assigned_worker_id           uuid references profiles(id),
  status                       text not null default 'pending'
                                 check (status in ('pending','confirmed','in_progress','completed','cancelled')),
  scheduled_at                 timestamptz not null,
  estimated_duration_minutes   integer not null default 60,
  service_type                 text not null,
  service_notes                text,
  customer_notes               text,
  location_address             text,
  total_price                  numeric(10,2),
  highlevel_appointment_id     text unique,
  highlevel_calendar_id        text,
  calendar_color               text,                          -- optional hex color override for calendar display
  sms_confirmation_sent        boolean not null default false,
  sms_ready_for_pickup_sent    boolean not null default false,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

create index if not exists bookings_scheduled_at_idx on bookings(scheduled_at);
create index if not exists bookings_status_idx on bookings(status);
create index if not exists bookings_worker_idx on bookings(assigned_worker_id);

-- ── Cleaning Jobs ─────────────────────────────────────────────────────────
create table if not exists cleaning_jobs (
  id            uuid primary key default uuid_generate_v4(),
  booking_id    uuid not null unique references bookings(id) on delete cascade,
  worker_id     uuid not null references profiles(id),
  status        text not null default 'not_started'
                  check (status in ('not_started','in_progress','completed','needs_review')),
  started_at    timestamptz,
  completed_at  timestamptz,
  worker_notes  text,
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jobs_status_idx on cleaning_jobs(status);
create index if not exists jobs_worker_idx on cleaning_jobs(worker_id);

-- ── Job Images ────────────────────────────────────────────────────────────
create table if not exists job_images (
  id               uuid primary key default uuid_generate_v4(),
  job_id           uuid not null references cleaning_jobs(id) on delete cascade,
  storage_path     text not null,
  public_url       text not null,
  type             text not null check (type in ('before','after')),
  uploaded_by      uuid not null references profiles(id),
  file_size_bytes  integer,
  created_at       timestamptz not null default now()
);

create index if not exists images_job_idx on job_images(job_id);

-- ── SMS Logs ──────────────────────────────────────────────────────────────
create table if not exists sms_logs (
  id                    uuid primary key default uuid_generate_v4(),
  booking_id            uuid references bookings(id),
  customer_id           uuid not null references customers(id),
  phone_number          text not null,
  message_body          text not null,
  sms_type              text not null default 'manual'
                          check (sms_type in ('confirmation', 'ready_for_pickup', 'manual')),
  status                text not null default 'pending'
                          check (status in ('pending','sent','delivered','failed')),
  provider              text not null default 'highlevel'
                          check (provider in ('highlevel', '46elks', 'twilio')),
  highlevel_message_id  text,
  provider_message_id   text,
  delivery_callback_at  timestamptz,
  sent_at               timestamptz,
  error_message         text,
  created_at            timestamptz not null default now()
);

-- Prevents duplicate auto-SMS sends. Covers pending + sent so a second attempt
-- cannot be inserted while one is already in-flight.
create unique index if not exists sms_logs_booking_type_sent_idx
  on sms_logs(booking_id, sms_type)
  where sms_type in ('confirmation', 'ready_for_pickup')
    and status not in ('failed');

-- ── Activity Log ──────────────────────────────────────────────────────────
create table if not exists activity_log (
  id           uuid primary key default uuid_generate_v4(),
  actor_id     uuid references profiles(id),
  entity_type  text not null check (entity_type in ('booking','job','customer','car','worker')),
  entity_id    uuid not null,
  action       text not null,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists activity_log_entity_idx on activity_log(entity_type, entity_id);
create index if not exists activity_log_actor_idx  on activity_log(actor_id);

-- ── HighLevel Sync Logs ───────────────────────────────────────────────────
create table if not exists highlevel_sync_logs (
  id             uuid primary key default uuid_generate_v4(),
  entity_type    text not null check (entity_type in ('booking','customer','contact')),
  entity_id      text not null,
  highlevel_id   text,
  action         text not null check (action in ('create','update','delete','webhook_received')),
  payload        jsonb,
  success        boolean not null default true,
  error_message  text,
  created_at     timestamptz not null default now()
);

-- Idempotency: one successful processed delivery per highlevel_id.
-- Failed rows (success = false) are excluded so retries can re-insert and try again.
create unique index if not exists sync_logs_idempotency_idx
  on highlevel_sync_logs(highlevel_id)
  where action = 'webhook_received' and success = true;

-- ── Row Level Security ────────────────────────────────────────────────────
alter table profiles           enable row level security;
alter table customers          enable row level security;
alter table cars               enable row level security;
alter table bookings           enable row level security;
alter table cleaning_jobs      enable row level security;
alter table job_images         enable row level security;
alter table sms_logs           enable row level security;
alter table activity_log       enable row level security;
alter table highlevel_sync_logs enable row level security;

-- Read the caller's role without recursively applying profiles RLS.
create schema if not exists private;

create or replace function private.current_user_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;

revoke all on function private.current_user_has_role(text[]) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.current_user_has_role(text[]) to anon, authenticated;

-- Profiles: users see their own, admins/managers see all
create policy "profiles_select" on profiles for select
  using (
    auth.uid() = id
    or private.current_user_has_role(array['admin', 'manager'])
  );

create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);

-- Bookings: all authenticated workers can read; only admins/managers can write
create policy "bookings_select_auth" on bookings for select
  using (auth.uid() is not null);

create policy "bookings_insert_admin" on bookings for insert
  with check (exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','manager')
  ));

create policy "bookings_update_admin" on bookings for update
  using (exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','manager')
  ));

-- Cleaning jobs: workers can update their own jobs
create policy "jobs_select_auth" on cleaning_jobs for select
  using (auth.uid() is not null);

create policy "jobs_update_own" on cleaning_jobs for update
  using (worker_id = auth.uid() or exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','manager')
  ));

-- Job images: workers may only insert images for jobs assigned to them
create policy "images_select_auth" on job_images for select
  using (auth.uid() is not null);

create policy "images_insert_own_job" on job_images for insert
  with check (
    auth.uid() = uploaded_by and (
      exists (
        select 1 from cleaning_jobs where id = job_id and worker_id = auth.uid()
      ) or exists (
        select 1 from profiles where id = auth.uid() and role in ('admin','manager')
      )
    )
  );

-- Customers: all authenticated can read; admins can write
create policy "customers_select_auth" on customers for select
  using (auth.uid() is not null);

create policy "customers_write_admin" on customers for all
  using (exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','manager')
  ));

-- Cars: same as customers
create policy "cars_select_auth" on cars for select
  using (auth.uid() is not null);

create policy "cars_write_admin" on cars for all
  using (exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','manager')
  ));

-- SMS logs: admins only (service role bypasses RLS for webhook/auto sends)
create policy "sms_logs_admin" on sms_logs for all
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

-- Activity log: all authenticated can read; actor_id must match the caller
-- so log entries cannot be forged by another user.
create policy "activity_log_select" on activity_log for select
  using (auth.uid() is not null);

create policy "activity_log_insert" on activity_log for insert
  with check (auth.uid() = actor_id);

-- Sync logs: admins only
create policy "sync_logs_admin" on highlevel_sync_logs for all
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));
