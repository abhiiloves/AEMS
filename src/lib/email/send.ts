// Stubbed the same way as request-otp/route.ts — this scaffold doesn't
// require real SMTP credentials to run. Wire up nodemailer (or
// whatever provider) here; every caller in this project already goes
// through this one function, so that's the only place to change.
export async function sendEmail(to: string[], cc: string[], subject: string, html: string) {
  console.log(`[email] would send "${subject}" to ${to.join(", ")}${cc.length ? ` (cc: ${cc.join(", ")})` : ""}`);
  return { ok: true as const };
}

export function renderTemplate(bodyHtml: string, variables: Record<string, string>) {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}
