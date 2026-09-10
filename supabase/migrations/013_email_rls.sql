-- =====================================================================
-- AEMS v2 — RLS for email automation (templates/automations/logs)
-- Not covered in 006_rls_policies.sql — added here. Read/write is
-- admin+it_admin (this is system configuration, same tier as Settings
-- generally, not scoped by category/location/plant since an email
-- automation can legitimately span multiple plants).
-- =====================================================================

alter table email_templates enable row level security;
alter table email_automations enable row level security;
alter table email_execution_logs enable row level security;

create policy email_templates_all on email_templates for all
  using (current_app_role() in ('admin','it_admin'))
  with check (current_app_role() in ('admin','it_admin'));

create policy email_automations_all on email_automations for all
  using (current_app_role() in ('admin','it_admin'))
  with check (current_app_role() in ('admin','it_admin'));

-- Logs are read-only from the client; inserts happen only via the
-- service-role cron job (see /api/cron/email-automations), same
-- reasoning as audit_logs not having a client insert policy.
create policy email_logs_select on email_execution_logs for select
  using (current_app_role() in ('admin','it_admin'));
