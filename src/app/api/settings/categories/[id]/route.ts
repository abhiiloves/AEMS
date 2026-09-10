import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();
  const { data, error } = await supabase.from("asset_categories").update(body).eq("id", params.id).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: status === 403 ? "Only IT Admin can edit categories" : error.message }, { status });
  }
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("asset_categories").delete().eq("id", params.id);
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23503" ? 409 : 400;
    const message =
      status === 403
        ? "Only IT Admin can remove categories"
        : status === 409
        ? "This category still has assets or scoped users pointing to it"
        : error.message;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ ok: true });
}
