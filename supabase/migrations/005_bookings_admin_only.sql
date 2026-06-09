-- Restrict booking write operations to admin only.
-- Previously managers could also insert/update bookings (role in ('admin','manager')),
-- but the frontend enforces admin-only — this migration makes the DB match.
drop policy if exists "bookings_insert_admin" on bookings;
create policy "bookings_insert_admin" on bookings for insert
  with check (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

drop policy if exists "bookings_update_admin" on bookings;
create policy "bookings_update_admin" on bookings for update
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));
