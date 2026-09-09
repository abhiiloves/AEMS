import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Same pattern as departments/route.ts: read open to any authenticated
// user (sub_departments_read policy), write is IT-Admin-only
// (sub_departments_write policy, 014_department_hierarchy.sql). Works
// for both "add a sub-department to a brand-new department" and "add
// one to an existing department" — same POST body either way, just
// pass the department_id you already have.
export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("sub_departments")
    .select("id, name, department_id, department:department_id ( id, name )")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { name, department_id }

  const { data, error } = await supabase.from("sub_departments").insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can add sub-departments" : error.message },
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
    event_type: "create_sub_department",
    table_name: "sub_departments",
    record_id: data.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}
