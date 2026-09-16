-- ============================================================
-- Migration 009 — handle_new_user() must resolve `profiles` regardless of the
-- caller's search_path.
--
-- GoTrue's DB role (supabase_auth_admin) runs with search_path=auth only, so the
-- unqualified `insert into profiles` in the trigger failed with
-- "relation profiles does not exist" for every real signup / invite. This was
-- applied directly to the live DB on 2026-07-11 and is captured here so a fresh
-- database gets the same fix. Idempotent.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'worker')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
