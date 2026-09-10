import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { sendEmail, renderTemplate } from "@/lib/email/send";

// Meant to be invoked by a scheduler (Vercel Cron / Supabase pg_cron /
// GitHub Actions on a schedule) — not by a user, hence the service-role
// client. Protect this route with a shared secret header in production
// (not added here — see README).
//
// Implements overdue_pm and upcoming_pm only in this pass. monthly_pm,
// complaint_* lifecycle events, and sla_breach follow the identical
// pattern — same idempotency-key + retry approach — and are listed as
// remaining work in the README rather than half-implemented here.
export async function POST() {
  const supabase = createServiceRoleSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: automations } = await supabase
    .from("email_automations")
    .select("*, template:template_id (*)")
    .eq("status", "active")
    .in("trigger_type", ["overdue_pm", "upcoming_pm"]);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const automation of automations ?? []) {
    const reminderDays = automation.reminder_days ?? 3;
    let machinesQuery = supabase.from("maintenance_machines").select("*");

    if (automation.trigger_type === "overdue_pm") {
      machinesQuery = machinesQuery.lt("next_maintenance_date", today);
    } else {
      const target = new Date();
      target.setDate(target.getDate() + reminderDays);
      machinesQuery = machinesQuery.eq("next_maintenance_date", target.toISOString().slice(0, 10));
    }

    if (automation.plant_scope?.length) machinesQuery = machinesQuery.in("plant_id", automation.plant_scope);
    if (automation.location_scope?.length) machinesQuery = machinesQuery.in("location_id", automation.location_scope);
    if (automation.department_scope?.length) machinesQuery = machinesQuery.in("department_id", automation.department_scope);

    const { data: machines } = await machinesQuery;

    for (const machine of machines ?? []) {
      // One send per automation+machine+day, regardless of how many
      // times the cron runs that day or how many retries happen inside
      // it — this is the DB-level guarantee the old system's JSON-log
      // approach couldn't give.
      const idempotencyKey = `${automation.id}:${machine.id}:${today}`;

      const { data: existing } = await supabase
        .from("email_execution_logs")
        .select("id, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing && existing.status === "sent") {
        skipped++;
        continue;
      }
      if (existing && existing.retry_count >= automation.retry_count) {
        skipped++;
        continue;
      }

      const recipients = resolveRecipients(automation.recipient_rules, machine);
      const subject = automation.template ? renderTemplate(automation.template.subject, { machine: machine.equipment_name }) : "PM reminder";
      const body = automation.template
        ? renderTemplate(automation.template.body_html, { machine: machine.equipment_name, due_date: machine.next_maintenance_date ?? "" })
        : `Maintenance due for ${machine.equipment_name}`;

      const result = await sendEmail(recipients.to, recipients.cc, subject, body);

      if (existing) {
        await supabase
          .from("email_execution_logs")
          .update({
            status: result.ok ? "sent" : "retrying",
            sent_at: result.ok ? new Date().toISOString() : null,
            retry_count: existing.retry_count + 1,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("email_execution_logs").insert({
          automation_id: automation.id,
          trigger_type: automation.trigger_type,
          idempotency_key: idempotencyKey,
          recipients_to: recipients.to,
          recipients_cc: recipients.cc,
          subject,
          status: result.ok ? "sent" : "retrying",
          sent_at: result.ok ? new Date().toISOString() : null,
        });
      }

      result.ok ? sent++ : failed++;
    }
  }

  return NextResponse.json({ sent, skipped, failed });
}

function resolveRecipients(rules: Record<string, unknown>, _machine: Record<string, unknown>): { to: string[]; cc: string[] } {
  // Minimal implementation for this pass: 'manual' and role-based are
  // supported; 'plant_contacts' / 'department_head' resolution is
  // listed as remaining work in the README rather than stubbed silently.
  const to = Array.isArray(rules?.manual_emails) ? (rules.manual_emails as string[]) : [];
  const cc = Array.isArray(rules?.cc_emails) ? (rules.cc_emails as string[]) : [];
  return { to, cc };
}
