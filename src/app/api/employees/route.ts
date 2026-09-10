import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Access: RLS's employees_select/employees_write policies restrict this
// to hr/admin/it_admin roles (see 006_rls_policies.sql) — a plain
// `user` role gets zero rows back, not an error, same as the old
// system's Employee Directory being HR/Admin/IT-Admin only.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 25;

  let query = supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, corporate_email, contact_number, department_id, location_id, plant_id, is_active",
      { count: "exact" }
    )
    .order("full_name")
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (q && q.length >= 2) {
    // pg_trgm-backed, see idx_employees_search_trgm in 001_core_schema.sql
    query = query.or(`full_name.ilike.%${q}%,employee_code.ilike.%${q}%,corporate_email.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // "1 asset" / "3 assets" badge like the old Employee Directory cards —
  // done as one extra query instead of N+1 per employee.
  const ids = (data ?? []).map((e) => e.id);
  const { data: counts } = await supabase
    .from("asset_assignment_history")
    .select("employee_id")
    .in("employee_id", ids)
    .is("returned_on", null);

  const assetCountByEmployee = new Map<string, number>();
  for (const row of counts ?? []) {
    assetCountByEmployee.set(row.employee_id, (assetCountByEmployee.get(row.employee_id) ?? 0) + 1);
  }

  const enriched = (data ?? []).map((e) => ({ ...e, assigned_asset_count: assetCountByEmployee.get(e.id) ?? 0 }));

  return NextResponse.json({ data: enriched, total: count, page, pageSize });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const { data, error } = await supabase.from("employees").insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: appUser } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  await supabase.from("audit_logs").insert({
    user_id: appUser?.id,
    user_email: appUser?.email,
    user_role: appUser?.role,
    event_category: "data_change",
    event_type: "create",
    table_name: "employees",
    record_id: data.id,
    new_value: data,
    location_id: data.location_id,
  });

  return NextResponse.json({ data }, { status: 201 });
}
