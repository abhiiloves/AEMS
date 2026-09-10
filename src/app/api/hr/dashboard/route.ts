import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Mirrors the old HR Dashboard's four counter cards (Total Employees,
// Assets Assigned, Active Staff, Inactive Records) â€” but
// "Inactive Records" is a real query here, not a hardcoded 0 like the
// old system had.
export async function GET() {
  const supabase = await createServerSupabase();

  const [{ count: totalEmployees }, { count: activeStaff }, { count: inactiveRecords }, { count: assetsAssigned }] =
    await Promise.all([
      supabase.from("employees").select("*", { count: "exact", head: true }),
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", false),
      supabase.from("asset_assignment_history").select("*", { count: "exact", head: true }).is("returned_on", null),
    ]);

  return NextResponse.json({
    totalEmployees: totalEmployees ?? 0,
    assetsAssigned: assetsAssigned ?? 0,
    activeStaff: activeStaff ?? 0,
    inactiveRecords: inactiveRecords ?? 0,
  });
}
