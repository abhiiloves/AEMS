-- =====================================================================
-- AEMS v2 — enable Realtime on audit_logs
-- Required for lib/realtime/auditLogs.ts's IT-Admin-only live view.
-- Postgres changes broadcast still respects the audit_select RLS
-- policy, so this alone does not widen who can see what.
-- =====================================================================

alter publication supabase_realtime add table audit_logs;
