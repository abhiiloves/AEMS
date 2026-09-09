import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// This is the mechanism behind the project's decision on MAC/IP fields:
// "reference lo purana system se" -> flexible, IT-Admin-configurable
// fields per category (any category, not hardcoded to IT/Camera-NVR).
// Values entered against these definitions get stored in
// assets.custom_fields (jsonb) — see 001_core_schema.sql /
// 002_assets.sql.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("category_form_fields")
    .select("*")
    .eq("category_id", params.id)
    .order("display_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { field_name, field_label, field_type, is_required?, display_order? }

  const { data, error } = await supabase
    .from("category_form_fields")
    .insert({ ...body, category_id: params.id })
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can configure category fields" : error.message },
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
    event_type: "add_category_field",
    table_name: "category_form_fields",
    record_id: data.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}
