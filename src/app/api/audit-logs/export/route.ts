import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Per project decision: export is available to Admin as well as IT
// Admin (unlike suspicious-activity highlighting and realtime, which
// stay IT-Admin-only). Admin's export is automatically scoped to their
// own categories/locations/plants by the same audit_select RLS policy
// used for the list view â€” no separate scoping logic needed here.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  if (actor && !["admin", "it_admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only Admin/IT Admin can export audit logs" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("audit_logs")
    .select("created_at, user_email, user_role, event_category, event_type, table_name, plant_id, ip_address, approx_location")
    .order("created_at", { ascending: false })
    .limit(10000); // large exports should move to a background job instead â€” see README

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const header = "time,user_email,role,category,event,table,plant_id,ip_address,location\n";
  const rows = (data ?? [])
    .map((r) =>
      [r.created_at, r.user_email, r.user_role, r.event_category, r.event_type, r.table_name ?? "", r.plant_id ?? "", r.ip_address ?? "", r.approx_location ?? ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
