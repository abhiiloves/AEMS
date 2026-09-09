# AEMS v2 — starting scaffold

This is a **starting scaffold**, not a finished app. It gives you the
full database schema, RLS policies, and the core auth/permission/
session wiring, plus one fully-implemented reference module (Assets)
showing the pattern to repeat for every other module (Employees,
Damaged/Scrap, Preventive Maintenance, Email Automation, Audit Logs,
Settings, User Management).

## What's here

```
supabase/migrations/
  001_core_schema.sql          locations, plants, departments, categories,
                                dynamic form fields, employees, users, user_scope
  002_assets.sql                assets, assignment history, department
                                transfers, damaged/scrap
  003_preventive_maintenance.sql maintenance_machines, maintenance_complaints
                                (kept behaviourally identical to the old system)
  004_email_automation.sql      templates, automations, execution logs
                                (relational now, not JSON blobs)
  005_sessions_audit.sql        sessions (single-active-session), audit_logs
                                (combined table, event_category-split)
  006_rls_policies.sql          the real access-control layer
  007_triggers.sql              asset_code generation, assignment sync,
                                updated_at maintenance
  008_seed.sql                  baseline categories matching the old system
  009_scrap_status_sync.sql     asset status follows the scrap-review lifecycle
  010_otp_login.sql             OTP-only auth (reverted from password+2FA) —
                                hashed, DB-backed otp_codes table
  011_department_admin.sql      departments.admin_user_id — IT-Admin-assigned
                                responsible person. Originally
                                informational only (did NOT grant
                                access); superseded by 014 + the API
                                layer, which now also grants that
                                person edit access to the department
  012_audit_realtime.sql        enables Supabase Realtime on audit_logs
                                for the IT-Admin-only live view
  013_email_rls.sql             RLS for email templates/automations
  014_department_hierarchy.sql  departments now belong to a Plant;
                                new sub_departments table (one level
                                under a department); user_scope +
                                has_scope() extended with department_id/
                                sub_department_id so IT Admin can scope
                                a user down to one sub-department —
                                see the file's header comment, this
                                supersedes the original "department is
                                not access-scope" decision below. The
                                API layer (not this migration) also now
                                auto-grants a department's assigned
                                admin edit access to that department +
                                its sub-departments — see
                                grantDepartmentAdminScope() in
                                src/lib/settingsHelpers.ts

src/
  lib/supabase/client.ts        browser client (thin wrapper — see note below)
  lib/supabase/server.ts        server client (RLS-enforced) + isolated
                                service-role client
  lib/permissions.ts            permission helpers mirroring the RLS policies
  middleware.ts                 idle-timeout + single-session enforcement
  app/api/auth/request-otp/route.ts  send a hashed, rate-limited OTP
                                (DB-backed — fixes the old system's
                                in-memory-Map reliability bug)
  app/api/auth/verify-otp/route.ts  verify the code, mint a real
                                Supabase session via the admin API
  lib/auth/session.ts           shared session-finalization helper
                                (single-active-session enforcement)
  app/api/settings/departments/route.ts  list + create departments
                                (IT Admin only for writes, via RLS)
  app/api/settings/departments/[id]/route.ts  edit a department,
                                including (re)assigning admin_user_id
  app/api/maintenance/machines/route.ts  PM machines list+create,
                                gated by the "Prevention (PM)" category
  app/api/maintenance/machines/[id]/route.ts  update after a visit
  app/api/maintenance/complaints/route.ts  authenticated complaint
                                inbox (list + in-app report form)
  app/api/maintenance/complaints/[id]/resolve/route.ts  mark in-progress/
                                resolved, before/after photo + technician
                                names, matches old system's accountability feature
  app/api/maintenance/scan/[id]/route.ts  the ONE intentionally-public
                                write route (QR scan, no login) — uses
                                the service-role client under strict
                                hand-written validation + a per-machine
                                rate limit the old system didn't have
  app/api/audit-logs/route.ts   scoped list (RLS does it_admin-sees-all
                                / admin-sees-own-scope) + risk_level
                                annotation (>2 failed logins in 15 min
                                = yellow, >3 = red; high-value delete = red)
  app/api/audit-logs/export/route.ts  CSV export — Admin AND IT Admin
                                (not IT-Admin-only), same RLS scoping
  lib/auditRisk.ts              the suspicious-activity threshold rules,
                                kept in one place so list/export can't drift
  lib/realtime/auditLogs.ts     IT-Admin-only live subscription helper
  app/api/settings/locations/  + plants/ + categories/  list+create+edit+
                                remove, IT Admin only for writes (shared
                                boilerplate factored into lib/settingsHelpers.ts)
  app/api/settings/categories/[id]/fields/route.ts  dynamic per-category
                                custom fields (this is the MAC/IP
                                mechanism — flexible/configurable, not
                                hardcoded to IT/Camera-NVR, per decision)
  app/api/settings/email-templates/  + email-automations/  CRUD,
                                admin+it_admin (013_email_rls.sql)
  app/api/cron/email-automations/route.ts  evaluates overdue_pm/
                                upcoming_pm, sends with an idempotency
                                key (one send per automation+machine+day,
                                fixes the old JSON-log race condition)
                                and per-automation retry_count
  lib/email/send.ts             SMTP stub (same pattern as the OTP stub)
                                + simple {{variable}} template rendering
  app/api/assets/bulk-import/route.ts  CSV upload — admin/it_admin +
                                per-user can_bulk_import flag, chunked
                                inserts (500 rows/batch), per-row error
                                report so nothing silently drops
  app/api/assets/[id]/assign/route.ts  create an assignment (blocks if
                                already assigned — return it first),
                                trigger syncs assets.status/assigned_to
  app/api/assets/[id]/return/route.ts  close the open assignment,
                                condition-at-return check
  app/assets/page.tsx + components/AssetsBrowser.tsx  list page —
                                debounced search (min 2 chars, per
                                decision), status badges, pagination
  app/assets/new/page.tsx + components/AssetWizard.tsx  3-step
                                registration wizard (Select Category ->
                                Details incl. dynamic per-category
                                fields -> Assignment), mirrors the old
                                system's flow — see file comment for the
                                one deliberate structural difference
                                (single category picker, since the old
                                system's category+sub-type split is now
                                handled by category_form_fields instead)
  app/assets/[id]/page.tsx + components/AssetActions.tsx  asset profile:
                                details, full assignment-history timeline
                                (free query — see project notes), assign/
                                return/report-damaged actions
  app/damaged-scrap/page.tsx + components/DamagedScrapBoard.tsx  status-tab
                                board; review actions (Review/Approve/
                                Reject/Resolve) only render for Admin/IT
                                Admin (canReview prop) — the real gate is
                                still server-side RLS, this is UX only
  app/employees/page.tsx + components/EmployeeDirectory.tsx  searchable
                                card grid, assigned-asset-count badge
  app/employees/[id]/page.tsx  employee profile — current + full
                                assignment history (same free-query
                                pattern as the asset detail page)
  app/users/page.tsx + components/UserManagementBoard.tsx  user table
                                (email/role/scope/bulk-import/export
                                toggles), add-user form with the role-
                                assignment hierarchy applied to the
                                dropdown options, disable action
  app/maintenance/page.tsx + components/MaintenanceBoard.tsx  Machines /
                                Complaints tabs -- complaints reported via
                                the public QR route show up here too
                                (same table)
  app/audit-logs/page.tsx + components/AuditLogTable.tsx  category/role
                                filters, risk_level row highlighting
                                (yellow/red left border), export
                                (admin+it_admin), IT-Admin-only realtime
                                subscription wired to lib/realtime/auditLogs.ts
  app/settings/page.tsx + components/SettingsBoard.tsx  tabs for
                                Locations/Plants/Dynamic Categories/
                                Departments, matching the old system's
                                Settings layout (Audit Logs has its own
                                full page instead of a Settings tab --
                                it needed realtime/export/highlighting
                                that outgrew a tab)
  app/email-automation/page.tsx + components/EmailAutomationBoard.tsx
                                automations list with trigger/frequency/
                                template + a pause/resume toggle -- the
                                full editor (recipient rules, schedule
                                builder) is listed as remaining work
                                below rather than half-built
  app/api/auth/logout/route.ts  deactivates the session row + logs a
                                logout audit event before signing out
  components/AppShell.tsx       sidebar + topbar, deliberately mirrors
                                the old system's nav grouping (Asset
                                Categories, then Preventive Setup, then
                                Management) per the "keep what was
                                decided to stay the same" instruction
  app/login/page.tsx             two-step OTP login screen
  app/dashboard/page.tsx         main dashboard — server component,
                                same stat-card + category-summary layout
                                as the old screenshots, all counts run
                                through RLS so an Admin only ever sees
                                their own scope's numbers
  tailwind.config.ts / app/globals.css  design tokens (see "Design
                                system" section below)
  app/api/assets/route.ts       reference module: scoped list+search+create
                                with audit logging
  app/api/employees/route.ts    employee directory: search+pagination+create,
                                includes current-assigned-asset count per row
  app/api/employees/[id]/route.ts  employee profile — current assets +
                                full assignment history (free query, since
                                assignment is history-driven, never an
                                in-place overwrite)
  app/api/hr/dashboard/route.ts HR dashboard counters (Total/Assigned/
                                Active/Inactive — Inactive is a real query
                                now, the old system hardcoded it to 0)
  app/api/damaged-scrap/route.ts  list + report (anyone in scope can report)
  app/api/damaged-scrap/[id]/route.ts  approve/reject/resolve — admin/it_admin
                                only, syncs assets.status via trigger
                                (009_scrap_status_sync.sql)
  app/api/users/route.ts        list users + create, enforcing the
                                role-assignment hierarchy (it_admin: any
                                role; admin: only 'user', or 'hr' if the
                                admin's own scope includes 'HR Operations')
  app/api/users/[id]/route.ts   edit (it_admin only) / soft-disable
  app/api/users/[id]/scope/route.ts  assign/remove Category+Location+Plant
                                scope rows — it_admin only via RLS. A
                                scope row with everything null +
                                can_edit=false is the "global read-only
                                Admin" variant (no separate 5th role)
```

## Run it

1. `cp .env.example .env.local` and fill in a **fresh** Supabase project's
   URL/keys — do not reuse anything from the old project's leaked `.env`.
2. Run the migrations in order against that project (Supabase CLI or SQL editor):
   `supabase db push` or paste each file into the SQL editor in numeric order.
3. `npm install && npm run dev`

## Decisions this scaffold encodes (so nothing has to be re-derived from chat)

- **Permission model**: Category + Location + Plant + Department +
  Sub-department scoping via `user_scope` (extended 2026-09, see
  014_department_hierarchy.sql). Originally the project scoped only
  Category+Location+Plant and treated `department_id` on `assets`/
  `employees` as pure ownership metadata never used for access control
  — that decision is now superseded: `has_scope()` also checks
  department_id/sub_department_id when present, so IT Admin can
  restrict a user down to a single sub-department. Every dimension
  still follows the same NULL-means-unrestricted convention, so
  existing scope rows that don't set department/sub-department keep
  working unchanged.
- **Roles**: `it_admin`, `admin`, `hr`, `user` — fixed enum, not a generic
  role_permissions table. The "global read-only Admin" is just a `user_scope`
  row with everything `null` + `can_edit = false` — no fifth role.
- **Role assignment**: IT Admin can assign anything. Admin can only assign
  `user`, or `hr` if their own scope includes the `HR Operations` category.
- **Auth**: back to OTP-based login for everyone (per project decision —
  reverted from an earlier password+2FA plan to match the previous
  system). The OTP code itself is custom (`otp_codes` table, hashed,
  rate-limited: max 5 sends/15 min, 60s resend cooldown, max 5 verify
  attempts) instead of Supabase's built-in auth email, so branding/
  templates stay under the project's own email-automation system. This
  also fixes the old system's real bug: its OTP lived in a Node
  in-memory `Map`, which isn't reliable across serverless instances —
  here it's in Postgres, so any instance can verify it correctly.
- **Sessions**: single active session per user (`idx_one_active_session_per_user`),
  auto-kicks the old one. Idle timeout 5 min for admin/it_admin, 3-4 hr for
  user/hr, enforced server-side in `middleware.ts` (client-side
  disconnect/sleep detection should call the same logout endpoint —
  not implemented in this scaffold yet).
- **Audit logs**: one table, `event_category` splits session vs data-change
  events for fast filtering and different retention (purge `session` rows
  after 90 days; keep `data_change` rows long-term — set up as a scheduled
  job, not included here).
- **Damaged/Scrap**: report (anyone in scope) vs approve/reject/resolve
  (admin/it_admin only) are separate RLS policies, not one.
- **Delete + bulk import**: admin/it_admin only, and per-user toggleable
  via `users.can_bulk_import` / `users.can_export` (IT Admin manages these).
- **MAC/IP/etc.**: not hardcoded to IT/Camera-NVR. `category_form_fields` +
  `assets.custom_fields jsonb` let IT Admin configure fields per category,
  matching the old system's "Dynamic Categories & Form Fields" behaviour.
- **AWS portability**: RLS policies call `current_app_user()` /
  `current_app_role()` wrapper functions instead of `auth.uid()` directly,
  so swapping Supabase Auth for Cognito later means rewriting two SQL
  functions, not every policy.

## Fixed from the previous system (see the security review earlier in this project)

- No `userEmail`/`x-user-email` fallback-auth bypass anywhere. Every write
  goes through a real session + RLS.
- RLS policies actually exist (the old project had `enable row level
  security` with zero `create policy` statements).
- Typed, FK-enforced columns instead of `text` + `jsonb`-blob-everything.
- Email automation is relational, not JSON files/blobs in a storage bucket
  (removes the concurrent-write race condition on the log).
- No secrets in this repo. Rotate the old project's Supabase service-role
  key, SQL password, and session secret if you haven't already — they were
  exposed in the AEMS.zip shared earlier in this project.

## Frontend design system

Internal, data-dense industrial tool — the old system's navy-header /
clean-white-card language is kept on purpose (asset registers,
permission tables, audit logs need clarity over flair), not reinvented
for novelty. One deliberate addition: an amber "attention" color
reserved only for things that need action (overdue PM, pending scrap
review) so it actually signals something instead of decorating.

- Colors: `navy-950/900/800/700` (header/sidebar), `accent` (#2f6fed,
  primary actions), `attention` (amber, needs-review states only),
  `danger`/`success` for status, `surface`/`ink` for neutrals.
- Type: Inter for everything — one family, a real type scale via
  Tailwind's defaults, no decorative second typeface for a tool this
  functional.
- Components: `.card`, `.btn-primary`, `.btn-secondary`, `.input`,
  `.label`, `.badge` utility classes in `globals.css` — build new pages
  out of these rather than one-off styles, so the whole app stays
  visually consistent as more pages get added.

## Not yet built (next passes)

**Every module now has both a working API layer and a working UI
page** — Assets, Employees, Damaged/Scrap, User Management, Preventive
Maintenance, Audit Logs, Settings, Email Automation, plus Login/
Dashboard/AppShell. This is a complete, coherent first version, not a
finished production app. Specifically still open:

- Email Automation: the board lists automations and can pause/resume
  them, but there's no template/automation *editor* UI yet (creating
  one still has to go through the API directly). Only
  `overdue_pm`/`upcoming_pm` triggers are evaluated by the cron job;
  `monthly_pm`, the `complaint_*` lifecycle events, and `sla_breach`
  aren't wired up. Recipient-rule resolution only handles
  `manual_emails`/`cc_emails`, not role-based/`plant_contacts`/
  `department_head`. Consolidation mode (digest vs individual) isn't
  implemented. The cron route has no shared-secret check yet -- add one
  before exposing it publicly.
- Audit Logs: the "new/unrecognized IP" suspicious-activity rule isn't
  implemented (failed-login clustering and high-value-delete are).
- Settings: category custom-field management (adding MAC/IP-style
  fields to a category) has an API route but no UI yet -- only the
  category list itself has one.
- User Management: scope assignment now has a UI (Access panel per
  user, Plant → Department → Sub-department cascading selects, plus
  Category and Location) — see UserManagementBoard.tsx. New users
  still get created with no scope by default and need at least one
  scope row added via this panel.
- Settings → Departments: rename, delete, and department-admin
  assignment all have UI now (Pencil/Trash icons + admin dropdown per
  row). Delete is FK-protected — it fails with a clear message if
  anything (assets, employees, sub-departments, a user's scope) still
  references the department.
- Audit Logs: every row that has old_value/new_value (any create,
  edit, or delete of a Location/Plant/Department/Sub-department/Asset/
  etc.) now has an expand chevron showing exactly which fields
  changed, old value struck through next to the new one — not just
  "something happened", but what.
- General: no loading skeletons/error boundaries, no toasts (some
  actions use `alert`/`prompt`, which work but aren't the final
  polish), no automated tests, and this hasn't been run against a real
  Supabase project yet -- do that before treating it as done.
- 2FA enrollment and the old password-era UI don't exist since the
  project reverted to OTP-only auth.

None of this changes the architecture -- it's the same pattern
(RLS-scoped queries, audit logging, permission checks mirrored
client-side for UX) applied to fewer surfaces than exist. Ask for any
specific gap closed next.
