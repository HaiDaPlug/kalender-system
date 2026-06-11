-- Policies on profiles must not query profiles directly: doing so causes
-- PostgreSQL to apply the same RLS policy recursively.
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

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (
    auth.uid() = id
    or private.current_user_has_role(array['admin', 'manager'])
  );

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  using (private.current_user_has_role(array['admin']))
  with check (private.current_user_has_role(array['admin']));

drop policy if exists "profiles_insert_admin" on profiles;
create policy "profiles_insert_admin" on profiles for insert
  with check (private.current_user_has_role(array['admin']));
