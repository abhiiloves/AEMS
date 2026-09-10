import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Prevention (PM) is treated as its own permission category (not tied
// to any particular asset category) â€” see maint_machines_select/write
// in 006_rls_policies.sql. A user can have "Prevention (PM)" scope
// without having access to the underlying asset's own category at all,
// matching the previous system's behaviour exactly.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 25;

  const { data, error, count } = await supabase
    .from("maintenance_machines")
    .select(
      "id, equipment_name, machine_type, department_id, location_id, plant_id, next_maintenance_date, last_maintenance_date, status, asset_id",
      { count: "exact" }
    )
    .order("next_maintenance_date", { ascending: true, nullsFirst: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data, total: count, page, pageSize });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const body = await req.json();

  const { data, error } = await supabase.from("maintenance_machines").insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only Admin/IT Admin with Prevention (PM) scope can add machines" : error.message },
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
    event_type: "create_maintenance_machine",
    table_name: "maintenance_machines",
    record_id: data.id,
    new_value: data,
    plant_id: data.plant_id,
    location_id: data.location_id,
  });

  return NextResponse.json({ data }, { status: 201 });
}
