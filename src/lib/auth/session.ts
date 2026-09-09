import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Called after any successful login (OTP verify is the only path now
// that the system is back to OTP-only auth). Enforces the single-
// active-session rule: auto-kicks any existing session for this user,
// no confirmation step, per project decision.
export async function finalizeSession(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  sessionToken: string,
  req: NextRequest
) {
  await supabase.from("sessions").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);

  await supabase.from("sessions").insert({
    user_id: userId,
    session_token: sessionToken,
    role,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    device_info: req.headers.get("user-agent"),
  });

  await supabase.from("audit_logs").insert({
    user_id: userId,
    user_role: role,
    event_category: "session",
    event_type: "login",
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    device_info: req.headers.get("user-agent"),
  });
}
