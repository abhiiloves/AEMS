import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Called after any successful login (OTP verify is the only path now
// that the system is back to OTP-only auth). Enforces the single-
// active-session rule: auto-kicks any existing session for this user,
// no confirmation step, per project decision.
//
// IMPORTANT (fixed in cross-check): this used to store Supabase's
// access_token as sessions.session_token and have middleware.ts look
// it up on every request. Supabase's supabase-ssr client silently
// rotates that token on refresh, so within one access-token lifetime
// the stored value would go stale and middleware would treat a
// perfectly valid session as "ended". Now we mint our own random,
// opaque session id, independent of the auth token's lifecycle, and
// carry it in its own cookie.
export async function finalizeSession(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  _accessToken: string,
  req: NextRequest
) {
  const sessionId = crypto.randomUUID();

  const { error: deactivateError } = await supabase.from("sessions").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
  if (deactivateError) throw new Error(`Could not deactivate prior session: ${deactivateError.message}`);

  const { error: insertError } = await supabase.from("sessions").insert({
    user_id: userId,
    session_token: sessionId,
    role,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    device_info: req.headers.get("user-agent"),
  });
  if (insertError) throw new Error(`Could not create session: ${insertError.message}`);

  (await cookies()).set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
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
