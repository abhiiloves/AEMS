import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { canAssignRole, type Role } from "@/lib/permissions";

// Matches the User Management table from the old system: email, role,
// locations, plants, categories, actions — plus the per-user
// can_bulk_import/can_export toggles the project added on top.
export async function GET() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("users")
    .select(
      `
      id, email, role, is_active, mfa_enabled, can_bulk_import, can_export, created_at,
      user_scope ( id, location_id, plant_id, category_id, can_edit )
    `
    )
    .order("email");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { email, role, employee_id?, scope: [{location_id, plant_id, category_id, can_edit}] }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, role").eq("auth_id", user?.id).single();
  if (!actor) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Role-assignment hierarchy (per project decision):
  //  - it_admin: any role
  //  - admin: only 'user', or 'hr' if the admin's own scope includes
  //    the 'HR Operations' category (the "HR ka admin" rule)
  let actorHasHrScope = false;
  if (actor.role === "admin" && body.role === "hr") {
    const { data: hrCategory } = await supabase.from("asset_categories").select("id").eq("name", "HR Operations").single();
    const { count } = await supabase
      .from("user_scope")
      .select("*", { count: "exact", head: true })
      .eq("user_id", actor.id)
      .eq("category_id", hrCategory?.id);
    actorHasHrScope = (count ?? 0) > 0;
  }

  if (!canAssignRole(actor.role as Role, body.role as Role, actorHasHrScope)) {
    return NextResponse.json({ error: `Your role cannot assign the '${body.role}' role` }, { status: 403 });
  }

  const { data: newUser, error } = await supabase
    .from("users")
    .insert({ email: body.email, role: body.role, employee_id: body.employee_id ?? null, created_by: actor.id })
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  if (Array.isArray(body.scope) && body.scope.length > 0) {
    const rows = body.scope.map((s: any) => ({ ...s, user_id: newUser.id }));
    await supabase.from("user_scope").insert(rows);
  }

  await supabase.from("audit_logs").insert({
    user_id: actor.id,
    event_category: "data_change",
    event_type: "create_user",
    table_name: "users",
    record_id: newUser.id,
    new_value: newUser,
  });

  return NextResponse.json({ data: newUser }, { status: 201 });
}
