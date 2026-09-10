import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const { data, error } = await supabase.from("locations").update(body).eq("id", params.id).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: status === 403 ? "Only IT Admin can edit locations" : error.message }, { status });
  }
  return NextResponse.json({ data });
}

// Locations are referenced everywhere (assets, employees, user_scope,
// audit_logs...) — the FK constraints will simply reject this delete
// if anything still points to it, which is the right behaviour rather
// than a silent cascade that could orphan asset records.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("locations").delete().eq("id", params.id);
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23503" ? 409 : 400;
    const message =
      status === 403
        ? "Only IT Admin can remove locations"
        : status === 409
        ? "This location is still in use by other records"
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true });
}
