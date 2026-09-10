-- =====================================================================
-- AEMS v2 — Email automation
-- Same concepts/behaviour as the previous system (templates,
-- automations, recipient rules, retry, consolidation), but stored as
-- proper relational tables instead of JSON blobs in a storage bucket —
-- the old approach had a real concurrent-write race condition on the
-- log file and could not be indexed/queried.
-- =====================================================================

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  subject text not null,
  body_html text not null,
  variables text[],
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table email_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null,      -- overdue_pm, upcoming_pm, monthly_pm, complaint_*, sla_breach, custom
  status text not null default 'active',
  frequency text not null,         -- instant/daily/weekly/monthly
  schedule_times text[],
  reminder_days int,
  location_scope uuid[],
  plant_scope uuid[],
  department_scope uuid[],
  recipient_rules jsonb not null default '{}'::jsonb,  -- small/bounded, jsonb is fine here
  template_id uuid references email_templates(id),
  consolidation_mode text default 'individual',
  retry_count int not null default 3,
  retry_interval_minutes int not null default 15,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table email_execution_logs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references email_automations(id),
  trigger_type text,
  idempotency_key text unique,      -- DB-level duplicate-send prevention
  sender text,
  recipients_to text[],
  recipients_cc text[],
  subject text,
  status text not null,             -- sent/failed/retrying
  sent_at timestamptz,
  failure_reason text,
  retry_count int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_email_logs_automation on email_execution_logs (automation_id, created_at desc);
