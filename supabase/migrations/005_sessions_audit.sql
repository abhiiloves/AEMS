-- =====================================================================
-- AEMS v2 — Sessions (single active session enforcement) + Audit logs
-- =====================================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_token text not null unique,
  role user_role not null,
  device_info text,
  ip_address inet,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now(),
  is_active boolean not null default true
);

-- Enforces: only one active session per user at a time. A new login
-- flips the old row's is_active to false (application logic) before
-- inserting its own row, so this index never actually conflicts —
-- it's the backstop guaranteeing the invariant holds under races too.
create unique index idx_one_active_session_per_user
  on sessions (user_id) where is_active = true;

create index idx_sessions_last_activity on sessions (last_activity);

-- Single combined audit table (session events + data-change events),
-- split by event_category for fast filtering and differential
-- retention (session rows: 90 days: data_change rows: kept long-term).
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  user_email text,                      -- denormalized so it survives user deletion
  user_role user_role,                  -- denormalized snapshot at time of event, not live-joined

  event_category audit_event_category not null,
  event_type text not null,             -- login/logout/failed_login/auto_logout_idle/
                                          -- auto_logout_disconnect/auto_logout_sleep/
                                          -- session_expired / create/update/delete/approve...

  table_name text,                      -- data_change events only
  record_id uuid,
  old_value jsonb,
  new_value jsonb,

  ip_address inet,
  approx_location text,
  plant_id uuid references plants(id),
  location_id uuid references locations(id),
  device_info text,
  session_duration interval,            -- filled on logout-type events

  created_at timestamptz not null default now()
);

create index idx_audit_category_time on audit_logs (event_category, created_at desc);
create index idx_audit_user_time on audit_logs (user_id, created_at desc);
create index idx_audit_plant_time on audit_logs (plant_id, created_at desc);

comment on table audit_logs is
  'Retention: event_category=session rows should be purged after 90 days '
  'by a scheduled job; event_category=data_change rows are kept long-term.';
