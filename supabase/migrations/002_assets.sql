-- =====================================================================
-- AEMS v2 — Assets, assignment history, department transfers, scrap
-- =====================================================================

create table assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,      -- auto-generated e.g. IT-2026-00001
  account_asset_code text,              -- optional accounting reference
  category_id uuid not null references asset_categories(id),
  department_id uuid references departments(id),   -- ownership metadata, NOT access-scope
  location_id uuid references locations(id),
  plant_id uuid references plants(id),

  brand text,
  model text,
  serial_no text unique,
  condition text,                       -- 'existing_asset','new_asset'

  status asset_status not null default 'available',
  assigned_to uuid references employees(id),          -- kept in sync by assignment triggers only
  current_assignment_id uuid,           -- FK added after asset_assignment_history exists

  vendor_name text,
  po_number text,
  purchase_date date,
  purchase_cost numeric(12,2),
  warranty_start date,
  warranty_end date,
  amc_details jsonb,

  custom_fields jsonb not null default '{}'::jsonb,   -- category-specific fields (MAC/IP/etc.)

  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references users(id),

  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assets_category on assets (category_id) where is_deleted = false;
create index idx_assets_location_plant on assets (location_id, plant_id) where is_deleted = false;
create index idx_assets_status on assets (status) where is_deleted = false;
create index idx_assets_search_trgm on assets
  using gin ((coalesce(asset_code,'') || ' ' || coalesce(serial_no,'') || ' ' ||
              coalesce(brand,'') || ' ' || coalesce(model,'')) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Assignment history — every assign/return is a new row, never an
-- in-place edit of assets.assigned_to. This is what makes "how many
-- laptops has employee X had" and "who has had asset Y" free queries.
-- ---------------------------------------------------------------------
create table asset_assignment_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  employee_id uuid not null references employees(id),
  assigned_on timestamptz not null default now(),
  assigned_by uuid references users(id),
  returned_on timestamptz,
  return_reason text,                   -- 'reassigned','resigned','transferred','damaged'
  condition_at_assignment text,
  condition_at_return text,
  remarks text
);
create index idx_history_asset on asset_assignment_history (asset_id, assigned_on desc);
create index idx_history_employee on asset_assignment_history (employee_id, assigned_on desc);
create unique index idx_one_open_assignment_per_asset
  on asset_assignment_history (asset_id) where returned_on is null;

alter table assets
  add constraint fk_assets_current_assignment
  foreign key (current_assignment_id) references asset_assignment_history(id);

-- ---------------------------------------------------------------------
-- Department transfers — simple logged update, no approval step
-- (per project decision, following the previous system's approach)
-- ---------------------------------------------------------------------
create table asset_department_transfers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  from_department_id uuid references departments(id),
  to_department_id uuid references departments(id),
  transferred_by uuid references users(id),
  transfer_reason text,
  transferred_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Damaged / Scrap — full lifecycle with report/approve split
-- (User can only report; Admin/IT Admin approve/reject/resolve)
-- ---------------------------------------------------------------------
create table damaged_scrap_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  reported_by uuid references users(id),
  reason text,
  photo_url text,
  status scrap_status not null default 'reported',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_scrap_asset on damaged_scrap_records (asset_id);
create index idx_scrap_status on damaged_scrap_records (status);
