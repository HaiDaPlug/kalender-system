-- ============================================================
-- Migration 010 — booking deletion hardening
--
-- 1. There was never a DELETE policy on bookings, so a session-scoped delete
--    silently affected 0 rows (the UI still said "deleted"). Admins may delete.
-- 2. sms_logs.booking_id referenced bookings without ON DELETE, so a booking
--    with any SMS history could not be deleted at all. Keep the log row, drop
--    the link (the message history stays on the customer).
-- 3. Reviewers (admin + manager) may update cleaning_jobs and insert shifts on
--    behalf of others through the API; the API uses the service role for that,
--    but make the intent explicit at the DB level too.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. Admin may delete bookings
drop policy if exists "bookings_delete_admin" on bookings;
create policy "bookings_delete_admin" on bookings for delete
  using (private.current_user_has_role(array['admin']));

-- 2. SMS logs survive booking deletion
alter table sms_logs drop constraint if exists sms_logs_booking_id_fkey;
alter table sms_logs
  add constraint sms_logs_booking_id_fkey
  foreign key (booking_id) references bookings(id) on delete set null;

-- 3. Reviewers may create cleaning jobs for any worker (workers still only for themselves)
drop policy if exists "jobs_insert" on cleaning_jobs;
create policy "jobs_insert" on cleaning_jobs for insert
  with check (
    auth.uid() = worker_id
    or private.current_user_has_role(array['admin', 'manager'])
  );

-- Keep updated_at fresh on bookings/customers/profiles without relying on the app
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at
  before update on bookings
  for each row execute function public.set_updated_at();

drop trigger if exists customers_updated_at on customers;
create trigger customers_updated_at
  before update on customers
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();
