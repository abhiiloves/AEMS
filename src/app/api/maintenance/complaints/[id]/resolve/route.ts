import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// This is the in-app complaint form (logged-in user). The QR-scan
// public route (/api/maintenance/scan/[id]) is separate and
// intentionally unauthenticated â€” see that file. Both funnel into the
// same maintenance_complaints table.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // reported/in_progress/resolved
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 25;

  let query = supabase
    .from("maintenance_complaints")
    .select(
      `
      id, complaint_text, reporter_name, reporter_phone, downtime_minutes,
      photo_url, status, resolution_photo_url, reported_at, resolved_at,
      machine:machine_id ( id, equipment_name, plant_id, location_id )
    `,
      { count: "exact" }
    )
    .order("reported_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data, total: count, page, pageSize });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  // reporter_name / reporter_phone are typed by hand in the form â€” no
  // auto-fill from the logged-in session, matching the previous
  // system's behaviour (per project decision).
  const body = await req.json();

  const { data, error } = await supabase
    .from("maintenance_complaints")
    .insert({ ...body, status: "reported" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  await supabase.from("audit_logs").insert({
    user_id: actor?.id,
    user_email: actor?.email,
    user_role: actor?.role,
    event_category: "data_change",
    event_type: "report_complaint",
    table_name: "maintenance_complaints",
    record_id: data.id,
    new_value: data,
  });

  return NextResponse.json({ data }, { status: 201 });
}
