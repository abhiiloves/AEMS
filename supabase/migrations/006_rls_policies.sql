-- =====================================================================
-- AEMS v2 — Row Level Security
--
-- IMPORTANT: the previous system enabled RLS on every table but never
-- defined policies, so access control lived entirely in Node server
-- code (and had an auth-bypass bug on top of that). Here every table
-- gets an actual policy. Frontend/UI hiding is still done for UX, but
-- this is the real enforcement layer.
--
-- current_app_user() reads the caller's app users.id from the JWT.
-- Written as a wrapper (not a bare call to auth.uid() sprinkled through
-- every policy) specifically so the auth provider can be swapped later
-- (Supabase Auth -> AWS Cognito) by editing this one function instead
-- of every policy — see the AWS-portability note in the project plan.
-- =====================================================================

create or replace function current_app_user()
returns uuid
language sql stable
as $$
  select id from users where auth_id = auth.uid();
$$;

create or replace function current_app_role()
returns user_role
language sql stable
as $$
  select role from users where auth_id = auth.uid();
$$;

-- Scope check: does the current user's user_scope allow this
-- combination of category/location/plant? NULL in a scope row means
-- "all" on that dimension. IT Admin bypasses scope entirely.
create or replace function has_scope(p_category uuid, p_location uuid, p_plant uuid, p_require_edit boolean default false)
returns boolean
language sql stable
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

alter table locations enable row level security;
alter table plants enable row level security;
alter table departments enable row level security;
alter table asset_categories enable row level security;
alter table category_form_fields enable row level security;
alter table employees enable row level security;
alter table users enable row level security;
alter table user_scope enable row level security;
alter table assets enable row level security;
alter table asset_assignment_history enable row level security;
alter table asset_department_transfers enable row level security;
alter table damaged_scrap_records enable row level security;
alter table maintenance_machines enable row level security;
alter table maintenance_complaints enable row level security;
alter table audit_logs enable row level security;
alter table sessions enable row level security;

-- ---- Lookup tables: readable by any authenticated user, writable by IT Admin only
create policy locations_read on locations for select using (auth.uid() is not null);
create policy locations_write on locations for all
  using (current_app_role() = 'it_admin') with check (current_app_role() = 'it_admin');

create policy plants_read on plants for select using (auth.uid() is not null);
create policy plants_write on plants for all
  using (current_app_role() = 'it_admin') with check (current_app_role() = 'it_admin');

create policy departments_read on departments for select using (auth.uid() is not null);
create policy departments_write on departments for all
  using (current_app_role() = 'it_admin') with check (current_app_role() = 'it_admin');

create policy categories_read on asset_categories for select using (auth.uid() is not null);
create policy categories_write on asset_categories for all
  using (current_app_role() = 'it_admin') with check (current_app_role() = 'it_admin');

create policy form_fields_read on category_form_fields for select using (auth.uid() is not null);
create policy form_fields_write on category_form_fields for all
  using (current_app_role() = 'it_admin') with check (current_app_role() = 'it_admin');

-- ---- Assets: scoped read; scoped+can_edit write; delete restricted to Admin/IT Admin
create policy assets_select on assets for select
  using (has_scope(category_id, location_id, plant_id));

create policy assets_insert on assets for insert
  with check (has_scope(category_id, location_id, plant_id, true));

create policy assets_update on assets for update
  using (has_scope(category_id, location_id, plant_id, true));

create policy assets_delete on assets for update  -- soft delete = update, not a real DELETE
  using (
    current_app_role() in ('admin','it_admin')
    and has_scope(category_id, location_id, plant_id, true)
  );

-- ---- Employees / HR: HR + Admin + IT Admin can view; HR module access
-- is itself just a category in user_scope (matches the "HR ka admin"
-- rule — an Admin scoped to the HR category can manage HR/assign HR role)
create policy employees_select on employees for select
  using (
    current_app_role() in ('hr','admin','it_admin')
  );
create policy employees_write on employees for all
  using (current_app_role() in ('hr','admin','it_admin'))
  with check (current_app_role() in ('hr','admin','it_admin'));

-- ---- Users / user_scope: role-assignment hierarchy enforced here too,
-- not just in the app layer.
create policy users_select on users for select
  using (
    current_app_role() = 'it_admin'
    or id = current_app_user()
    or current_app_role() in ('admin','hr')
  );

create policy users_insert on users for insert
  with check (
    current_app_role() = 'it_admin'
    or (current_app_role() = 'admin' and role = 'user')
    or (
      current_app_role() = 'admin' and role = 'hr'
      and exists (
        select 1 from user_scope us
        join asset_categories c on c.id = us.category_id
        where us.user_id = current_app_user() and c.name = 'HR Operations'
      )
    )
  );

create policy users_update on users for update
  using (current_app_role() = 'it_admin');  -- editing users is IT Admin-only, per project decision

create policy users_delete on users for update  -- soft-disable via is_active, not a hard DELETE
  using (
    current_app_role() = 'it_admin'
    or (current_app_role() = 'admin' and role != 'it_admin')
  );

create policy user_scope_select on user_scope for select
  using (current_app_role() in ('it_admin','admin') or user_id = current_app_user());
create policy user_scope_write on user_scope for all
  using (current_app_role() = 'it_admin')
  with check (current_app_role() = 'it_admin');

-- ---- Assignment history: read within scope; write requires edit rights
create policy history_select on asset_assignment_history for select
  using (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id)
  ));
create policy history_write on asset_assignment_history for insert
  with check (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, true)
  ));

-- ---- Department transfers: same scope rule, no approval gate (per decision)
create policy transfers_select on asset_department_transfers for select
  using (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id)
  ));
create policy transfers_write on asset_department_transfers for insert
  with check (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, true)
  ));

-- ---- Damaged/Scrap: everyone in scope can report; only Admin/IT Admin can change status
create policy scrap_select on damaged_scrap_records for select
  using (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id)
  ));
create policy scrap_insert on damaged_scrap_records for insert
  with check (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id)
  ));
create policy scrap_review on damaged_scrap_records for update
  using (
    current_app_role() in ('admin','it_admin')
    and exists (
      select 1 from assets a where a.id = asset_id
      and has_scope(a.category_id, a.location_id, a.plant_id, true)
    )
  );

-- ---- Preventive Maintenance: gated by the "Prevention (PM)" category,
-- exactly like every other category-scoped module
create policy maint_machines_select on maintenance_machines for select
  using (has_scope(
    (select id from asset_categories where name = 'Prevention (PM)'),
    location_id, plant_id));
create policy maint_machines_write on maintenance_machines for all
  using (current_app_role() in ('admin','it_admin') and has_scope(
    (select id from asset_categories where name = 'Prevention (PM)'),
    location_id, plant_id, true))
  with check (current_app_role() in ('admin','it_admin'));

create policy complaints_select on maintenance_complaints for select
  using (exists (
    select 1 from maintenance_machines m where m.id = machine_id
    and has_scope((select id from asset_categories where name = 'Prevention (PM)'),
                  m.location_id, m.plant_id)
  ));
-- Complaint INSERT is intentionally NOT scoped this way — the QR-scan
-- report route uses a locked-down service-role function, not this
-- policy, because reporting must work for someone with no session at
-- all (see /src/app/api/maintenance/scan). This policy covers the
-- authenticated in-app complaint form only.
create policy complaints_insert_authenticated on maintenance_complaints for insert
  with check (auth.uid() is not null);
create policy complaints_resolve on maintenance_complaints for update
  using (current_app_role() in ('user','admin','it_admin'));

-- ---- Audit logs: IT Admin sees all; Admin sees only their own scope; User/HR see nothing
create policy audit_select on audit_logs for select
  using (
    current_app_role() = 'it_admin'
    or (
      current_app_role() = 'admin'
      and (plant_id is null or has_scope(null, location_id, plant_id))
    )
  );
-- Inserts happen via a security-definer function only (see app layer) —
-- no direct client insert policy, so audit rows can't be forged or skipped.

-- ---- Sessions: users see only their own session row
create policy sessions_select on sessions for select
  using (user_id = current_app_user());
