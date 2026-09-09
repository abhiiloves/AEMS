import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { computeRiskLevel, type AuditRow } from "@/lib/auditRisk";

// Scoping is entirely RLS's job (audit_select policy in
// 006_rls_policies.sql: it_admin sees everything, admin sees only rows
// whose plant/location falls in their own user_scope, user/hr get zero
// rows). This route doesn't duplicate that logic — it just adds
// filtering, pagination, and the risk_level annotation on top of
// whatever RLS already returned.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category"); // session | data_change
  const role = searchParams.get("role");
  const plantId = searchParams.get("plantId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 50;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, user_id, user_email, user_role, event_category, event_type, table_name, record_id, old_value, new_value, ip_address, approx_location, plant_id, location_id, device_info, session_duration, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (category) query = query.eq("event_category", category);
  if (role) query = query.eq("user_role", role);
  if (plantId) query = query.eq("plant_id", plantId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // For failed-login clustering, pull a slightly wider window per
  // email actually present on this page rather than re-deriving it
  // per row with N separate queries.
  const emails = [...new Set((data ?? []).filter((r) => r.event_type === "failed_login").map((r) => r.user_email))];
  let failedLoginHistory: AuditRow[] = [];
  if (emails.length > 0) {
    const { data: history } = await supabase
      .from("audit_logs")
      .select("id, user_email, event_type, created_at")
      .eq("event_type", "failed_login")
      .in("user_email", emails as string[])
      .order("created_at", { ascending: false })
      .limit(500);
    failedLoginHistory = history ?? [];
  }

  const enriched = (data ?? []).map((row) => ({
    ...row,
    risk_level: computeRiskLevel(
      row as AuditRow,
      failedLoginHistory.filter((h) => h.user_email === row.user_email)
    ),
  }));

  return NextResponse.json({ data: enriched, total: count, page, pageSize });
}
