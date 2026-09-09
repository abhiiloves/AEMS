import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Never lets the client set assets.assigned_to directly — always goes
// through asset_assignment_history, whose trg_sync_assignment trigger
// (007_triggers.sql) updates assets.status/assigned_to. This is what
// makes "who has had this asset" and "how many laptops has employee X
// had" free queries instead of needing separate logging.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { employee_id, condition_at_assignment?, remarks? }

  const { data: openAssignment } = await supabase
    .from("asset_assignment_history")
    .select("id")
    .eq("asset_id", params.id)
    .is("returned_on", null)
    .maybeSingle();
  if (openAssignment) {
    return NextResponse.json({ error: "Asset is already assigned — return it before reassigning" }, { status: 409 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  const { data, error } = await supabase
    .from("asset_assignment_history")
    .insert({
      asset_id: params.id,
      employee_id: body.employee_id,
      assigned_by: actor?.id,
      condition_at_assignment: body.condition_at_assignment ?? null,
      remarks: body.remarks ?? null,
    })
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
    event_type: "assign_asset",
    table_name: "assets",
    record_id: params.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}
