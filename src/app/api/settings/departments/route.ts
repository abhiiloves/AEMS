import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
<<<<<<< HEAD
=======
import { grantDepartmentAdminScope } from "@/lib/settingsHelpers";
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592

// Reads are open to any authenticated user (departments_read policy),
// writes are IT-Admin-only (departments_write policy) — this route
// doesn't add its own gate on top, it just makes a denial readable.
export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("departments")
<<<<<<< HEAD
    .select("id, name, location_id, admin_user_id, admin:admin_user_id ( id, email )")
=======
    .select("id, name, location_id, plant_id, admin_user_id, plant:plant_id ( id, name ), admin:admin_user_id ( id, email )")
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
<<<<<<< HEAD
  const body = await req.json(); // { name, location_id?, admin_user_id? }
=======
  const body = await req.json(); // { name, plant_id?, location_id?, admin_user_id? }
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592

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

<<<<<<< HEAD
=======
  // Assigning an admin at creation time grants them edit access to
  // this department (and its sub-departments) right away — see
  // grantDepartmentAdminScope's comment for why.
  if (body.admin_user_id) {
    await grantDepartmentAdminScope(supabase, data.id, body.admin_user_id);
  }

>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
  return NextResponse.json({ data }, { status: 201 });
}
