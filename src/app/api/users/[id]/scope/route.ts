import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// user_scope_write RLS policy is it_admin-only, so this whole route is
// implicitly IT-Admin-gated at the DB level. This is also where the
// "global read-only Admin" gets created: a row with location_id=null,
// plant_id=null, category_id=null, can_edit=false.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { location_id?, plant_id?, category_id?, can_edit? }

  const { data, error } = await supabase
    .from("user_scope")
    .insert({ user_id: params.id, ...body })
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can manage permission scope" : error.message },
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
    event_type: "assign_scope",
    table_name: "user_scope",
    record_id: data.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const scopeId = searchParams.get("scopeId");
  if (!scopeId) return NextResponse.json({ error: "scopeId required" }, { status: 400 });

  const { error } = await supabase.from("user_scope").delete().eq("id", scopeId).eq("user_id", params.id);
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
