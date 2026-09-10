-- =====================================================================
-- AEMS v2 — department admin/responsible-person assignment
--
-- IMPORTANT: this is informational/ownership metadata, like
-- assets.department_id — it does NOT grant that user access. Real
-- access still only comes from user_scope (Category+Location+Plant),
-- per the project's core permission-model decision. A department
-- "admin" here just means "the person this department's records point
-- to as responsible" (shows up in reports, HR dashboard, etc.) —
-- if that person should actually be able to manage the department's
-- assets, they still need a matching user_scope row separately.
-- =====================================================================

alter table departments add column admin_user_id uuid references users(id);

-- Only IT Admin can create a department or (re)assign its admin —
-- same departments_write policy as before, now also covering this
-- column since "for all" already applies to update.
