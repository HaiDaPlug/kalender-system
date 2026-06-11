-- Allow workers to submit bookings for approval.
-- Workers can only insert bookings with status='pending' — admin/manager can use any status.
-- created_by tracks who submitted the booking (used for approval email notification).

alter table bookings add column if not exists created_by uuid references profiles(id);

-- Replace the admin-only insert policy with one that also allows workers (pending only)
drop policy if exists "bookings_insert_admin" on bookings;
drop policy if exists "bookings_insert_worker" on bookings;
create policy "bookings_insert_worker" on bookings for insert
  with check (
    private.current_user_has_role(array['admin', 'manager'])
    or (
      status = 'pending'
      and auth.uid() is not null
    )
  );
