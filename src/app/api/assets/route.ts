import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Reference implementation for every other module (Employees, Damaged/
// Scrap, Maintenance, ...): RLS does the actual scoping (see
// 006_rls_policies.sql â€” this query runs as the caller via the
// server client, so a query with no filters at all still only returns
// rows the user's user_scope allows). This route layer exists for
// search/pagination ergonomics and for writing to audit_logs, not for
// re-implementing access control that RLS already guarantees.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 25;

  let query = supabase
    .from("assets")
    .select("id, asset_code, brand, model, status, category_id, location_id, plant_id, serial_no", {
      count: "exact",
    })
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (q && q.length >= 2) {
    // pg_trgm-backed ilike, see idx_assets_search_trgm in 002_assets.sql
    query = query.or(`asset_code.ilike.%${q}%,serial_no.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data, total: count, page, pageSize });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const body = await req.json();

  // RLS's assets_insert policy (has_scope with require_edit=true) is
  // the actual gate. If the caller isn't in scope, this insert simply
  // fails at the database â€” the try/catch below turns that into a 403
  // instead of leaking a raw Postgres error.
  const { data, error } = await supabase.from("assets").insert(body).select().single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400; // 42501 = RLS denial
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
    event_type: "create",
    table_name: "assets",
    record_id: data.id,
    new_value: data,
    plant_id: data.plant_id,
    location_id: data.location_id,
  });

  return NextResponse.json({ data }, { status: 201 });
}
