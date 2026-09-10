<<<<<<< HEAD
import nodemailer from "nodemailer";

// Real SMTP sending. Reads config from env vars (set in .env.local —
// see .env.example). Falls back to console-logging the code if SMTP
// isn't configured yet, so local dev still works without real
// credentials (check your terminal output for the code in that case).
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465, // true only for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return transporter;
}

export async function sendEmail(to: string[], cc: string[], subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email] SMTP not configured — would have sent "${subject}" to ${to.join(", ")}`);
    console.log(`[email] body: ${html}`);
    return { ok: true as const };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to.join(", "),
      cc: cc.length ? cc.join(", ") : undefined,
      subject,
      html,
    });
    return { ok: true as const };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false as const };
  }
=======
// Stubbed the same way as request-otp/route.ts — this scaffold doesn't
// require real SMTP credentials to run. Wire up nodemailer (or
// whatever provider) here; every caller in this project already goes
// through this one function, so that's the only place to change.
export async function sendEmail(to: string[], cc: string[], subject: string, html: string) {
  console.log(`[email] would send "${subject}" to ${to.join(", ")}${cc.length ? ` (cc: ${cc.join(", ")})` : ""}`);
  return { ok: true as const };
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
}

export function renderTemplate(bodyHtml: string, variables: Record<string, string>) {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}
