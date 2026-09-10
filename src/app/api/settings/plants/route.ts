import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createLookupRow } from "@/lib/settingsHelpers";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("plants").select("*, location:location_id ( id, name )").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { name, location_id }
  const { response } = await createLookupRow(supabase, "plants", body, "Only IT Admin can add plants");
  return response;
}
