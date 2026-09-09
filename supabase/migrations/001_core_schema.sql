-- =====================================================================
-- AEMS v2 — Core schema (lookup tables, users, permission scope)
-- Reference: previous AEMS system (business logic/UX kept, storage
-- layer fully redesigned — typed columns, FKs, real RLS, no bypasses)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('it_admin', 'admin', 'hr', 'user');
create type asset_status as enum ('available', 'assigned', 'maintenance', 'scrapped');
create type scrap_status as enum ('reported', 'under_review', 'approved', 'rejected', 'resolved');
create type audit_event_category as enum ('session', 'data_change');

-- ---------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table plants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id uuid references locations(id),
  created_at timestamptz not null default now(),
  unique (name, location_id)
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  location_id uuid references locations(id),
  created_at timestamptz not null default now()
);

create table asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- 'IT Assets','Electrical Assets','Prevention (PM)', etc.
  is_functional_module boolean not null default false, -- true for 'Prevention (PM)' style entries
  code_prefix text not null,          -- 'IT','ELEC','CAM' — used in asset_code generation
  created_at timestamptz not null default now()
);

-- Admin-configurable custom fields per category (MAC/IP/etc.)
-- Reference: previous system's "Dynamic Categories & Form Fields" — flexible,
-- not hardcoded to any specific category.
create table category_form_fields (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references asset_categories(id) on delete cascade,
  field_name text not null,           -- 'mac_address','ip_address','firmware_version'
  field_label text not null,
  field_type text not null check (field_type in ('text','number','ip','date','select')),
  is_required boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, field_name)
);

-- ---------------------------------------------------------------------
-- Employees (org directory — separate from system users/logins)
-- ---------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name text not null,
  corporate_email text,
  contact_number text,
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  plant_id uuid references plants(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_search_trgm on employees
  using gin ((coalesce(full_name,'') || ' ' || coalesce(employee_code,'')) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- System users (logins). Linked 1:1 to Supabase auth.users via auth_id.
-- ---------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique,                 -- references auth.users(id), set on signup
  email text not null unique,
  employee_id uuid references employees(id),
  role user_role not null default 'user',
  mfa_required boolean generated always as (role in ('admin','it_admin')) stored,
  mfa_enabled boolean not null default false,
  can_bulk_import boolean not null default true,   -- IT Admin-toggleable per Admin user
  can_export boolean not null default true,        -- IT Admin-toggleable per Admin user
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-user permission scope. NULL in any column = "All" for that dimension.
-- can_edit=false + all-null scope = the "global read-only Admin" variant.
create table user_scope (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  location_id uuid references locations(id),
  plant_id uuid references plants(id),
  category_id uuid references asset_categories(id),
  can_edit boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_user_scope_user on user_scope (user_id);

comment on table user_scope is
  'Category+Location+Plant based permission scoping (per project decision — '
  'not department-based). NULL in a column means unrestricted on that dimension.';
