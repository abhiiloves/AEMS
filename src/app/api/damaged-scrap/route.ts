import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Report vs approve is split at the RLS layer (scrap_insert vs
// scrap_review policies in 006_rls_policies.sql) â€” this route doesn't
// need to re-check "is this user allowed to report" because anyone in
// scope can; PATCH on [id]/route.ts is where the approve/reject/resolve
// gate actually lives (admin/it_admin only).
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // reported/under_review/approved/rejected/resolved
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 25;

  let query = supabase
    .from("damaged_scrap_records")
    .select(
      `
      id, reason, status, photo_url, created_at, updated_at,
      reported_by, reviewed_by, reviewed_at, resolution_notes,
      assets:asset_id ( id, asset_code, brand, model, category_id, plant_id, location_id )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data, total: count, page, pageSize });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const body = await req.json(); // { asset_id, reason, photo_url? }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: appUser } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  const { data, error } = await supabase
    .from("damaged_scrap_records")
    .insert({ ...body, reported_by: appUser?.id, status: "reported" })
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
    event_type: "report_damaged_scrap",
    table_name: "damaged_scrap_records",
    record_id: data.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}
