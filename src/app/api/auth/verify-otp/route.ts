import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabase, createServiceRoleSupabase } from "@/lib/supabase/server";
import { finalizeSession } from "@/lib/auth/session";

const MAX_VERIFY_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Verifies the code against our own otp_codes table (see
// 010_otp_login.sql), then uses the service-role client to mint a real
// Supabase Auth session for that email â€” this is what lets the rest of
// the app (RLS, current_app_user(), etc.) keep working unchanged while
// the OTP itself is fully custom (own template/branding/rate-limits,
// not Supabase's built-in auth email).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const serviceClient = createServiceRoleSupabase();

  const { data: otpRow } = await serviceClient
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
    await serviceClient.from("otp_codes").update({ attempts }).eq("id", otpRow.id);

    // Same event_type as the password-era failed-login logging, so the
    // audit-log suspicious-activity thresholds (>2 yellow / >3 red)
    // apply the same way regardless of which auth method is active.
    await serviceClient.from("audit_logs").insert({
      user_email: email,
      event_category: "session",
      event_type: "failed_login",
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    });

    return NextResponse.json({ error: "Incorrect code.", attemptsRemaining: MAX_VERIFY_ATTEMPTS - attempts }, { status: 401 });
  }

  const { data: appUser } = await serviceClient.from("users").select("id, role, is_active, auth_id").eq("email", email).single();
  if (!appUser || !appUser.is_active) {
    return NextResponse.json({ error: "Account not provisioned or disabled" }, { status: 403 });
  }

  const { data: link, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) {
    console.error("[otp] could not generate auth link:", linkError);
    return NextResponse.json({ error: "Could not start session" }, { status: 500 });
  }

  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: link.properties.email_otp,
    type: "magiclink",
  });
  if (verifyError || !session.session) {
    console.error("[otp] could not verify auth link:", verifyError);
    return NextResponse.json({ error: "Could not start session" }, { status: 500 });
  }

  if (appUser.auth_id !== link.user.id) {
    const { error: userLinkError } = await serviceClient
      .from("users")
      .update({ auth_id: link.user.id })
      .eq("id", appUser.id);
    if (userLinkError) {
      console.error("[otp] could not link app user:", userLinkError);
      return NextResponse.json({ error: "Could not start session" }, { status: 500 });
    }
  }

  await finalizeSession(serviceClient, appUser.id, appUser.role, session.session.access_token, req);
  await serviceClient.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);

  return NextResponse.json({ ok: true });
}
