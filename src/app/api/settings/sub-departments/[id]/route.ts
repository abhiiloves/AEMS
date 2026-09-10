import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { name? }

  const { data, error } = await supabase.from("sub_departments").update(body).eq("id", params.id).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can edit sub-departments" : error.message },
      { status }
    );
  }
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("sub_departments").delete().eq("id", params.id);
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can remove sub-departments" : error.message },
      { status }
    );
  }
  return NextResponse.json({ ok: true });
}
