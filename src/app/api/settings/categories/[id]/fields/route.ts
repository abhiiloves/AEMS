import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createLookupRow } from "@/lib/settingsHelpers";

// Matches the old system's "Dynamic Categories & Form Fields" tab.
// code_prefix drives asset_code generation (see set_asset_code trigger
// in 007_triggers.sql) â€” required at creation time, not optional.
export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("asset_categories").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const body = await req.json(); // { name, code_prefix, is_functional_module? }
  if (!body.code_prefix) {
    return NextResponse.json({ error: "code_prefix is required (used in asset code generation)" }, { status: 400 });
  }
  const { response } = await createLookupRow(supabase, "asset_categories", body, "Only IT Admin can add categories");
  return response;
}
