import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const { data: before } = await supabase.from("maintenance_machines").select("*").eq("id", params.id).single();
  const { data, error } = await supabase
    .from("maintenance_machines")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
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
    event_type: "update_maintenance_machine",
    table_name: "maintenance_machines",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  return NextResponse.json({ data });
}
