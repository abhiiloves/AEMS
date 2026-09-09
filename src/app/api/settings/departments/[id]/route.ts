import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { grantDepartmentAdminScope } from "@/lib/settingsHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { name?, location_id?, admin_user_id? }

  const { data: before } = await supabase.from("departments").select("*").eq("id", params.id).single();
  const { data, error } = await supabase.from("departments").update(body).eq("id", params.id).select().single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can edit departments" : error.message },
      { status }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  await supabase.from("audit_logs").insert({
    user_id: actor?.id,
    user_email: actor?.email,
    user_role: actor?.role,
    event_category: "data_change",
    event_type: body.admin_user_id !== undefined ? "assign_department_admin" : "update_department",
    table_name: "departments",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  // Reassigning/assigning an admin grants them edit access to this
  // department (and its sub-departments) — see
  // grantDepartmentAdminScope's comment for why. A prior admin's
  // scope row is left in place; IT Admin can remove it separately via
  // the Access panel if that access shouldn't continue.
  if (body.admin_user_id) {
    await grantDepartmentAdminScope(supabase, params.id, body.admin_user_id);
  }

  return NextResponse.json({ data });
}

// Departments are referenced by assets, employees, transfers, and now
// user_scope/sub_departments too (014_department_hierarchy.sql) — the
// FK constraints reject this delete if anything still points to the
// department, same as locations/plants, rather than silently
// cascading and orphaning those records. Logged to audit_logs the
// same way create/update are, so IT Admin sees it on the live Audit
// Logs page (012_audit_realtime.sql) — who deleted which department,
// and what its last known values were (old_value), immediately.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: before } = await supabase.from("departments").select("*").eq("id", params.id).single();
  const { error } = await supabase.from("departments").delete().eq("id", params.id);
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23503" ? 409 : 400;
    const message =
      status === 403
        ? "Only IT Admin can remove departments"
        : status === 409
        ? "This department still has assets, employees, sub-departments, or assigned users linked to it — reassign or remove those first"
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  await supabase.from("audit_logs").insert({
    user_id: actor?.id,
    user_email: actor?.email,
    user_role: actor?.role,
    event_category: "data_change",
    event_type: "delete_department",
    table_name: "departments",
    record_id: params.id,
    old_value: before,
  });

  return NextResponse.json({ ok: true });
}
