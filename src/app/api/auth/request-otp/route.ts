import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MINUTES = 15;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Same OTP behaviour as the old system (resend cooldown, max sends per
// window, max verify attempts), but the code itself lives in Postgres
// instead of a Node in-memory Map — the old system's OTP could silently
// fail on serverless because a different function instance might handle
// the verify request than the one that generated the code.
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const supabase = createServerSupabase();

  const windowStart = new Date(Date.now() - SEND_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("otp_codes")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false });

  if ((recent?.length ?? 0) >= MAX_SENDS_PER_WINDOW) {
    return NextResponse.json({ error: "Too many OTP requests. Try again later." }, { status: 429 });
  }

  const last = recent?.[0];
  if (last && Date.now() - new Date(last.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return NextResponse.json({ error: "Please wait before requesting another code." }, { status: 429 });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await supabase.from("otp_codes").insert({ email, code_hash: hashCode(code), expires_at: expiresAt });

  // Sent via the project's own email layer (lib/email/send.ts), not
  // Supabase's built-in auth email — keeps branding/control consistent
  // with the rest of the notification system. Falls back to logging
  // the code to the server console if SMTP env vars aren't set yet.
  await sendEmail(
    [email],
    [],
    "Your AEMS login code",
    `<p>Your one-time login code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>`
  );

  await supabase.from("audit_logs").insert({
    user_email: email,
    event_category: "session",
    event_type: "otp_requested",
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
  });

  return NextResponse.json({ ok: true });
}
