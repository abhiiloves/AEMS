import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// locations, plants, and asset_categories are all "read: any
// authenticated user, write: it_admin only" per their RLS policies —
// this shared helper avoids writing the same insert+audit-log
// boilerplate three times. Kept small and explicit on purpose rather
// than a generic ORM-style CRUD factory, since Settings tables tend to
// grow small special cases (e.g. category_form_fields nested under
// categories) that don't fit a fully generic version well.
export async function createLookupRow(
  supabase: SupabaseClient,
  table: "locations" | "plants" | "asset_categories" | "departments" | "sub_departments",
  body: Record<string, unknown>,
  actorPermissionErrorLabel: string
) {
  const { data, error } = await supabase.from(table).insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return { data: null, response: NextResponse.json({ error: status === 403 ? actorPermissionErrorLabel : error.message }, { status }) };
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
    event_type: `create_${table}`,
    table_name: table,
    record_id: (data as { id: string }).id,
    new_value: data,
  });

  return { data, response: NextResponse.json({ data }, { status: 201 }) };
}

// Per project decision (2026-09): assigning a department admin now
// also grants that person edit access to the department (and, via the
// same NULL-means-unrestricted convention has_scope() already uses,
// every sub-department under it — a scope row with department_id set
// and sub_department_id left null covers the whole department). This
// reverses 011_department_admin.sql's original "informational only,
// does not grant access" note. Only ever called from code paths
// already gated to IT Admin (departments_write), so the RLS-enforced
// client the caller passes in is safe to reuse here.
export async function grantDepartmentAdminScope(supabase: SupabaseClient, departmentId: string, userId: string) {
  const { data: existing } = await supabase
    .from("user_scope")
    .select("id, can_edit")
    .eq("user_id", userId)
    .eq("department_id", departmentId)
    .is("sub_department_id", null)
    .maybeSingle();

  if (existing) {
    if (!existing.can_edit) {
      await supabase.from("user_scope").update({ can_edit: true }).eq("id", existing.id);
    }
  } else {
    await supabase.from("user_scope").insert({ user_id: userId, department_id: departmentId, can_edit: true });
  }
}
