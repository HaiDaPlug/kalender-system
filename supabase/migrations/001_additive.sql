-- ============================================================
-- Migration 001 — additive changes on top of the initial schema
-- Run this against an existing Supabase database that already
-- has the tables from schema.sql. Safe to re-run (all ops are
-- idempotent or guarded with IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ── Bookings — new columns ────────────────────────────────────────────────
alter table bookings
  add column if not exists calendar_color             text,
  add column if not exists sms_ready_for_pickup_sent  boolean not null default false;

-- ── SMS Logs — richer lifecycle columns ───────────────────────────────────
alter table sms_logs
  add column if not exists sms_type             text not null default 'manual'
    check (sms_type in ('confirmation', 'ready_for_pickup', 'manual')),
  add column if not exists provider             text not null default 'highlevel'
    check (provider in ('highlevel', '46elks', 'twilio')),
  add column if not exists provider_message_id  text,
  add column if not exists delivery_callback_at timestamptz;

-- Unique index: one successful auto-SMS per type per booking.
-- Prevents duplicate confirmation or ready-for-pickup sends.
-- Uses a partial index so 'manual' and failed rows are not constrained.
create unique index if not exists sms_logs_booking_type_sent_idx
  on sms_logs(booking_id, sms_type)
  where sms_type in ('confirmation', 'ready_for_pickup')
    and status not in ('failed');

-- ── Activity Log — new table ──────────────────────────────────────────────
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

alter table activity_log enable row level security;

-- Activity log: any authenticated user can read; actor_id is enforced to match
-- the calling user so entries cannot be forged.
drop policy if exists "activity_log_select" on activity_log;
drop policy if exists "activity_log_insert" on activity_log;

create policy "activity_log_select" on activity_log for select
  using (auth.uid() is not null);

create policy "activity_log_insert" on activity_log for insert
  with check (auth.uid() = actor_id);

-- ── Job Images — tighten insert policy ───────────────────────────────────
-- The original policy (images_insert_auth) allowed any authenticated user to
-- upload to any job. Drop it and replace with a scoped policy.
drop policy if exists "images_insert_auth" on job_images;

-- Guard against the new policy already existing from a previous migration run
drop policy if exists "images_insert_own_job" on job_images;

create policy "images_insert_own_job" on job_images for insert
  with check (
    auth.uid() = uploaded_by
    and (
      exists (
        select 1 from cleaning_jobs
        where id = job_id and worker_id = auth.uid()
      )
      or exists (
        select 1 from profiles
        where id = auth.uid() and role in ('admin', 'manager')
      )
    )
  );

-- ── HighLevel Sync Logs — idempotency index ───────────────────────────────
-- Prevents duplicate successful webhook processing.
-- Failed rows (success = false) are excluded so retries are not blocked.
-- Drop and recreate because the old index (if applied) lacked the success condition.
drop index if exists sync_logs_idempotency_idx;
create unique index if not exists sync_logs_idempotency_idx
  on highlevel_sync_logs(highlevel_id)
  where action = 'webhook_received' and success = true;
