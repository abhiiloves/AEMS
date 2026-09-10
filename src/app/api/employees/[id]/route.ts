import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// This is the "kis-kis ko kitne laptop assign hue, history" answer
// from the project plan — free to query because assignment is
// history-driven (asset_assignment_history), never an in-place
// overwrite of assets.assigned_to.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: employee, error } = await supabase.from("employees").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: assignments } = await supabase
    .from("asset_assignment_history")
    .select(
      `
      id, assigned_on, returned_on, condition_at_assignment, condition_at_return,
      assets:asset_id ( id, asset_code, brand, model, category_id )
    `
    )
    .eq("employee_id", params.id)
    .order("assigned_on", { ascending: false });

  const current = (assignments ?? []).filter((a) => a.returned_on === null);
  const past = (assignments ?? []).filter((a) => a.returned_on !== null);

  return NextResponse.json({
    employee,
    currentAssets: current,
    assignmentHistory: past,
    totalAssetsEverAssigned: assignments?.length ?? 0,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const { data: before } = await supabase.from("employees").select("*").eq("id", params.id).single();
  const { data, error } = await supabase.from("employees").update(body).eq("id", params.id).select().single();
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
    event_type: "update",
    table_name: "employees",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  return NextResponse.json({ data });
}
