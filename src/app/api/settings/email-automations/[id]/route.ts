import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// trigger_type: overdue_pm | upcoming_pm | monthly_pm | complaint_created |
// complaint_resolved | sla_breach | custom â€” see /api/cron/email-automations
// for how each is evaluated.
export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("email_automations").select("*, template:template_id ( id, name )").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const body = await req.json();
  const { data, error } = await supabase.from("email_automations").insert(body).select().single();
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: status === 403 ? "Only Admin/IT Admin can manage email automations" : error.message }, { status });
  }
  return NextResponse.json({ data }, { status: 201 });
}
