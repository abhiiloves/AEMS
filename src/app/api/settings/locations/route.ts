import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createLookupRow } from "@/lib/settingsHelpers";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("locations").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const body = await req.json(); // { name }
  const { response } = await createLookupRow(supabase, "locations", body, "Only IT Admin can add locations");
  return response;
}
