import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { condition_at_return?, return_reason? }

  const { data: openAssignment } = await supabase
    .from("asset_assignment_history")
    .select("id")
    .eq("asset_id", params.id)
    .is("returned_on", null)
    .maybeSingle();

  if (!openAssignment) {
    return NextResponse.json({ error: "This asset has no open assignment to return" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  const { data, error } = await supabase
    .from("asset_assignment_history")
    .update({
      returned_on: new Date().toISOString(),
      condition_at_return: body.condition_at_return ?? null,
      return_reason: body.return_reason ?? null,
    })
    .eq("id", openAssignment.id)
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
    event_type: "return_asset",
    table_name: "assets",
    record_id: params.id,
    new_value: data,
  });

  return NextResponse.json({ data });
}
