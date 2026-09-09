-- =====================================================================
-- AEMS v2 — Preventive Maintenance (Prevention/PM)
-- Frontend + backend behaviour kept identical to the previous system
-- (schedule, reminders, logs, complaint inbox, QR-based public
-- reporting). Only the storage layer is typed/relational now, and the
-- auth-bypass bug from the old server is not carried over.
-- =====================================================================

create table maintenance_machines (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references assets(id),
  machine_type text,
  equipment_name text not null,
  department_id uuid references departments(id),
  location_id uuid references locations(id),
  plant_id uuid references plants(id),
  responsibility text,
  trend_months int,                      -- maintenance frequency
  next_maintenance_date date,
  last_maintenance_date date,
  status text default 'active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maint_machines_next_date on maintenance_machines (next_maintenance_date);

-- Reporter details are typed manually (matches previous system — no
-- login-based auto-fill), and the QR-scan report route stays public
-- (unauthenticated) intentionally; everything else in this module
-- requires a normal session.
create table maintenance_complaints (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references maintenance_machines(id),
  complaint_text text not null,
  reporter_name text not null,
  reporter_employee_id uuid references employees(id),
  reporter_phone text,
  downtime_minutes int,
  photo_url text,
  status text not null default 'reported',   -- reported/in_progress/resolved
  resolution_photo_url text,
  resolved_by uuid references users(id),
  resolved_technician_names text[],
  reported_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_complaints_machine on maintenance_complaints (machine_id, reported_at desc);
create index idx_complaints_status on maintenance_complaints (status);
