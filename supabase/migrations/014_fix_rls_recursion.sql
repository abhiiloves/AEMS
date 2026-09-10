-- =====================================================================
-- AEMS v2 — fix RLS infinite recursion (found in cross-check)
--
-- BUG: current_app_user()/current_app_role() run `select ... from users
-- where auth_id = auth.uid()`. Because `users` has RLS enabled, that
-- SELECT is itself gated by the users_select policy — which calls
-- current_app_role() again to evaluate itself. Every policy in
-- 006_rls_policies.sql calls these functions, so this recursion was
-- happening on essentially every query in the app.
--
-- FIX: mark the lookup functions SECURITY DEFINER (with search_path
-- pinned, as Postgres requires for safety) so they run with the
-- function owner's privileges and bypass RLS on `users`/`user_scope`
-- internally, breaking the recursion. They still only ever return data
-- about the CALLING user (auth.uid()), so this does not widen what any
-- policy actually permits — it only fixes how the check evaluates.
-- =====================================================================

create or replace function current_app_user()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from users where auth_id = auth.uid();
$$;

create or replace function current_app_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from users where auth_id = auth.uid();
$$;

create or replace function has_scope(p_category uuid, p_location uuid, p_plant uuid, p_require_edit boolean default false)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    current_app_role() = 'it_admin'
    or exists (
      select 1 from user_scope us
      where us.user_id = current_app_user()
        and (us.category_id is null or us.category_id = p_category)
        and (us.location_id is null or us.location_id = p_location)
        and (us.plant_id is null or us.plant_id = p_plant)
        and (not p_require_edit or us.can_edit = true)
    );
$$;

-- =====================================================================
-- FIX #2: audit_logs had NO insert policy at all (the original comment
-- said "inserts happen via a security-definer function only", but
-- every route built afterward actually inserts directly through the
-- RLS-enforced server client — meaning every audit-log write in the
-- whole app was being silently rejected). Adding a real insert policy
-- instead of the function that was never built, since rewriting every
-- route to call an RPC would be a much bigger change for the same
-- result. `with check` still stops anyone from forging another user's
-- identity in the log.
-- =====================================================================

create policy audit_insert on audit_logs for insert
  with check (
    user_id is null                    -- e.g. failed-login attempts before we know who it is
    or user_id = current_app_user()
  );
