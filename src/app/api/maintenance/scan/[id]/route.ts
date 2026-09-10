import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

// The ONLY intentionally-public write path in the system (per project
// decision: QR scan must work with no login, so a factory-floor worker
// can report a fault by scanning a machine's code). Everything else in
// the PM module requires a session — see complaints/route.ts and
// machines/route.ts. Excluded from middleware.ts's auth matcher.
//
// Because this bypasses RLS via the service-role client, it gets its
// own strict, hand-written validation instead of relying on policies:
//  - machine must exist
//  - required fields must be present and bounded in length
//  - a light per-machine rate limit, so this can't be used to flood
//    the table (previous system had no such rate limit here at all)
const MAX_REPORTS_PER_MACHINE_PER_HOUR = 10;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceRoleSupabase();
  const body = await req.json();

  if (!body.complaint_text || !body.reporter_name || !body.reporter_phone) {
    return NextResponse.json({ error: "Complaint, name, and phone are required" }, { status: 400 });
  }
  if (body.complaint_text.length > 1000 || body.reporter_name.length > 200) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  const { data: machine } = await supabase.from("maintenance_machines").select("id").eq("id", params.id).maybeSingle();
  if (!machine) return NextResponse.json({ error: "Machine not found" }, { status: 404 });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("maintenance_complaints")
    .select("*", { count: "exact", head: true })
    .eq("machine_id", params.id)
    .gte("reported_at", oneHourAgo);

  if ((count ?? 0) >= MAX_REPORTS_PER_MACHINE_PER_HOUR) {
    return NextResponse.json({ error: "Too many reports for this machine recently. Try again later." }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("maintenance_complaints")
    .insert({
      machine_id: params.id,
      complaint_text: body.complaint_text,
      reporter_name: body.reporter_name,
      reporter_phone: body.reporter_phone,
      photo_url: body.photo_url ?? null,
      status: "reported",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Could not submit report" }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
