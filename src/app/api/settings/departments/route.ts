import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Reads are open to any authenticated user (departments_read policy),
// writes are IT-Admin-only (departments_write policy) â€” this route
// doesn't add its own gate on top, it just makes a denial readable.
export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, location_id, admin_user_id, admin:admin_user_id ( id, email )")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const body = await req.json(); // { name, location_id?, admin_user_id? }

  const { data, error } = await supabase.from("departments").insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can add departments" : error.message },
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
    event_type: "create_department",
    table_name: "departments",
    record_id: data.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}
