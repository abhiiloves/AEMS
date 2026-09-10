import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// complaints_resolve RLS policy allows user/admin/it_admin (i.e. anyone
// with a session) — matches the old permission matrix where a User
// with Prevention (PM) scope could mark complaints done, same as
// Admin/IT Admin.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { status: 'in_progress'|'resolved', resolution_photo_url?, resolved_technician_names? }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "resolved") {
    update.resolved_at = new Date().toISOString();
    update.resolved_by = actor?.id;
    update.resolution_photo_url = body.resolution_photo_url ?? null;
    update.resolved_technician_names = body.resolved_technician_names ?? null;
  }

  const { data: before } = await supabase.from("maintenance_complaints").select("*").eq("id", params.id).single();
  const { data, error } = await supabase
    .from("maintenance_complaints")
    .update(update)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  await supabase.from("audit_logs").insert({
    user_id: actor?.id,
    user_email: actor?.email,
    user_role: actor?.role,
    event_category: "data_change",
    event_type: `complaint_${body.status}`,
    table_name: "maintenance_complaints",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  return NextResponse.json({ data });
}
