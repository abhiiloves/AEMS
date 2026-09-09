import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: appUser } = await supabase.from("users").select("id, role").eq("auth_id", user.id).single();
    if (appUser) {
      await supabase.from("sessions").update({ is_active: false }).eq("user_id", appUser.id).eq("is_active", true);
      await supabase.from("audit_logs").insert({
        user_id: appUser.id,
        user_role: appUser.role,
        event_category: "session",
        event_type: "logout", // client-side sleep/disconnect logout events use auto_logout_* instead — see README
      });
    }
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url));
}
