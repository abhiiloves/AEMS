-- =====================================================================
-- AEMS v2 — Plant-linked departments, sub-departments, and
-- department/sub-department-level user scoping
--
-- PERMISSION MODEL CHANGE (per request, 2026-09): the project's
-- original decision (see README) was Category+Location+Plant scoping
-- only — department_id on assets was explicitly "ownership metadata,
-- NOT access-scope". This migration supersedes that: user_scope and
-- has_scope() now also understand department/sub-department, so IT
-- Admin can restrict a user down to one sub-department, not just one
-- plant. Every other scope dimension still works exactly as before —
-- this only adds two more optional narrowing dimensions.
-- =====================================================================

-- Departments now belong to a specific Plant. A plant already belongs
-- to a Location, so a department's location is implied through its
-- plant. The old departments.location_id column is left in place for
-- backward compatibility (nothing reads it going forward) — do not
-- drop it, some existing rows may only have it set.
alter table departments add column plant_id uuid references plants(id);

-- One level of hierarchy under a department. IT Admin can add these
-- both when creating a brand-new department and later on an existing
-- one — same table either way, no separate flow needed.
create table sub_departments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (department_id, name)
);
create index idx_sub_departments_department on sub_departments (department_id);

-- Let assets be tagged down to sub-department too, so scoping can
-- actually filter access at that level (department_id already existed
-- on assets from 002_assets.sql).
alter table assets add column sub_department_id uuid references sub_departments(id);

-- The new scope dimensions. NULL means "unrestricted on this
-- dimension", same convention as location_id/plant_id/category_id.
alter table user_scope add column department_id uuid references departments(id);
alter table user_scope add column sub_department_id uuid references sub_departments(id);
create index idx_user_scope_department on user_scope (department_id);
create index idx_user_scope_sub_department on user_scope (sub_department_id);

alter table sub_departments enable row level security;
create policy sub_departments_read on sub_departments for select using (auth.uid() is not null);
create policy sub_departments_write on sub_departments for all
  using (current_app_role() = 'it_admin') with check (current_app_role() = 'it_admin');

-- Extend has_scope() with two new *appended* optional parameters, so
-- every existing positional call-site — has_scope(cat, loc, plant) and
-- has_scope(cat, loc, plant, true) — keeps compiling and behaving
-- exactly as before (defaults to NULL, i.e. "don't check this
-- dimension"). The asset-facing policies below are then explicitly
-- upgraded to pass department/sub_department too.
create or replace function has_scope(
  p_category uuid,
  p_location uuid,
  p_plant uuid,
  p_require_edit boolean default false,
  p_department uuid default null,
  p_sub_department uuid default null
)
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
        and (us.department_id is null or us.department_id = p_department)
        and (us.sub_department_id is null or us.sub_department_id = p_sub_department)
        and (not p_require_edit or us.can_edit = true)
    );
$$;

-- ---- Assets: now also department/sub_department scoped
drop policy assets_select on assets;
create policy assets_select on assets for select
  using (has_scope(category_id, location_id, plant_id, false, department_id, sub_department_id));

drop policy assets_insert on assets;
create policy assets_insert on assets for insert
  with check (has_scope(category_id, location_id, plant_id, true, department_id, sub_department_id));

drop policy assets_update on assets;
create policy assets_update on assets for update
  using (has_scope(category_id, location_id, plant_id, true, department_id, sub_department_id));

drop policy assets_delete on assets;
create policy assets_delete on assets for update  -- soft delete = update, not a real DELETE
  using (
    current_app_role() in ('admin','it_admin')
    and has_scope(category_id, location_id, plant_id, true, department_id, sub_department_id)
  );

-- ---- Assignment history: same widened scope, read through the asset
drop policy history_select on asset_assignment_history;
create policy history_select on asset_assignment_history for select
  using (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, false, a.department_id, a.sub_department_id)
  ));

drop policy history_write on asset_assignment_history;
create policy history_write on asset_assignment_history for insert
  with check (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, true, a.department_id, a.sub_department_id)
  ));

-- ---- Department transfers: same widened scope
drop policy transfers_select on asset_department_transfers;
create policy transfers_select on asset_department_transfers for select
  using (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, false, a.department_id, a.sub_department_id)
  ));

drop policy transfers_write on asset_department_transfers;
create policy transfers_write on asset_department_transfers for insert
  with check (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, true, a.department_id, a.sub_department_id)
  ));

-- ---- Damaged/Scrap: same widened scope (review/approve stays
-- Admin/IT-Admin-only, unchanged)
drop policy scrap_select on damaged_scrap_records;
create policy scrap_select on damaged_scrap_records for select
  using (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, false, a.department_id, a.sub_department_id)
  ));

drop policy scrap_insert on damaged_scrap_records;
create policy scrap_insert on damaged_scrap_records for insert
  with check (exists (
    select 1 from assets a where a.id = asset_id
    and has_scope(a.category_id, a.location_id, a.plant_id, false, a.department_id, a.sub_department_id)
  ));

drop policy scrap_review on damaged_scrap_records;
create policy scrap_review on damaged_scrap_records for update
  using (
    current_app_role() in ('admin','it_admin')
    and exists (
      select 1 from assets a where a.id = asset_id
      and has_scope(a.category_id, a.location_id, a.plant_id, true, a.department_id, a.sub_department_id)
    )
  );
