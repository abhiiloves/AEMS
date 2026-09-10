import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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

  return NextResponse.json({ data });
}
