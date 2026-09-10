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
}

export function renderTemplate(bodyHtml: string, variables: Record<string, string>) {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}
