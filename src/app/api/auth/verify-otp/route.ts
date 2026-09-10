import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { finalizeSession } from "@/lib/auth/session";

const MAX_VERIFY_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Verifies the code against our own otp_codes table (see
// 010_otp_login.sql), then uses the service-role client to mint a real
// Supabase Auth session for that email — this is what lets the rest of
// the app (RLS, current_app_user(), etc.) keep working unchanged while
// the OTP itself is fully custom (own template/branding/rate-limits,
// not Supabase's built-in auth email).
export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  const supabase = createServerSupabase();

  const { data: otpRow } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRow || new Date(otpRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Code expired or not found. Request a new one." }, { status: 400 });
  }

  if (otpRow.attempts >= MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
  }

  if (otpRow.code_hash !== hashCode(code)) {
    const attempts = otpRow.attempts + 1;
    await supabase.from("otp_codes").update({ attempts }).eq("id", otpRow.id);

    // Same event_type as the password-era failed-login logging, so the
    // audit-log suspicious-activity thresholds (>2 yellow / >3 red)
    // apply the same way regardless of which auth method is active.
    await supabase.from("audit_logs").insert({
      user_email: email,
      event_category: "session",
      event_type: "failed_login",
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    });

    return NextResponse.json({ error: "Incorrect code.", attemptsRemaining: MAX_VERIFY_ATTEMPTS - attempts }, { status: 401 });
  }

  await supabase.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);

  const { data: appUser } = await supabase.from("users").select("id, role, is_active").eq("email", email).single();
  if (!appUser || !appUser.is_active) {
    return NextResponse.json({ error: "Account not provisioned or disabled" }, { status: 403 });
  }

  const serviceClient = createServiceRoleSupabase();
  const { data: link, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) {
    return NextResponse.json({ error: "Could not start session" }, { status: 500 });
  }

  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "magiclink",
  });
  if (verifyError || !session.session) {
    return NextResponse.json({ error: "Could not start session" }, { status: 500 });
  }

  await finalizeSession(supabase, appUser.id, appUser.role, session.session.access_token, req);

  return NextResponse.json({ ok: true });
}
