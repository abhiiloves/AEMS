import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
<<<<<<< HEAD
import { cookies } from "next/headers";
import crypto from "node:crypto";

export const SESSION_COOKIE = "aems_sid";
=======
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592

// Called after any successful login (OTP verify is the only path now
// that the system is back to OTP-only auth). Enforces the single-
// active-session rule: auto-kicks any existing session for this user,
// no confirmation step, per project decision.
<<<<<<< HEAD
//
// IMPORTANT (fixed in cross-check): this used to store Supabase's
// access_token as sessions.session_token and have middleware.ts look
// it up on every request. Supabase's supabase-ssr client silently
// rotates that token on refresh, so within one access-token lifetime
// the stored value would go stale and middleware would treat a
// perfectly valid session as "ended". Now we mint our own random,
// opaque session id, independent of the auth token's lifecycle, and
// carry it in its own cookie.
=======
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
export async function finalizeSession(
  supabase: SupabaseClient,
  userId: string,
  role: string,
<<<<<<< HEAD
  _accessToken: string,
  req: NextRequest
) {
  const sessionId = crypto.randomUUID();

=======
  sessionToken: string,
  req: NextRequest
) {
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
  await supabase.from("sessions").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);

  await supabase.from("sessions").insert({
    user_id: userId,
<<<<<<< HEAD
    session_token: sessionId,
=======
    session_token: sessionToken,
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
    role,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    device_info: req.headers.get("user-agent"),
  });

<<<<<<< HEAD
  cookies().set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });

=======
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
  await supabase.from("audit_logs").insert({
    user_id: userId,
    user_role: role,
    event_category: "session",
    event_type: "login",
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    device_info: req.headers.get("user-agent"),
  });
}
