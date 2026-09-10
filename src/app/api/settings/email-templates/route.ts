import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("email_templates").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { name, category?, subject, body_html, variables? }
  const { data, error } = await supabase.from("email_templates").insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: status === 403 ? "Only Admin/IT Admin can manage email templates" : error.message }, { status });
  }
  return NextResponse.json({ data }, { status: 201 });
}
