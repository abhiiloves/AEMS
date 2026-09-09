import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// The real gate is RLS's scrap_review policy (admin/it_admin + in-scope
// only) — this app-level check just turns a denial into a clean 403
// message instead of a raw Postgres error, per the project's "don't
// re-implement access control, just make the failure readable" pattern.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { status: 'under_review'|'approved'|'rejected'|'resolved', resolution_notes? }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: appUser } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  if (appUser && !["admin", "it_admin"].includes(appUser.role)) {
    return NextResponse.json({ error: "Only Admin/IT Admin can review Damaged/Scrap reports" }, { status: 403 });
  }

  const { data: before } = await supabase.from("damaged_scrap_records").select("*").eq("id", params.id).single();

  const { data, error } = await supabase
    .from("damaged_scrap_records")
    .update({
      status: body.status,
      resolution_notes: body.resolution_notes ?? null,
      reviewed_by: appUser?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  await supabase.from("audit_logs").insert({
    user_id: appUser?.id,
    user_email: appUser?.email,
    user_role: appUser?.role,
    event_category: "data_change",
    event_type: `scrap_${body.status}`, // e.g. scrap_approved, scrap_rejected, scrap_resolved
    table_name: "damaged_scrap_records",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  return NextResponse.json({ data });
}
