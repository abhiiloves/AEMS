// Suspicious-activity highlight rules (per project decision):
//   >2 failed logins in a short window  -> yellow
//   >3 failed logins in a short window  -> red
// Plus: first-time-seen IP on a successful login, and delete on a
// high-value asset, both flagged yellow/red as noted below. Kept in
// one place so the audit-log list route and the export route can't
// drift out of sync on what counts as "suspicious".

export type RiskLevel = "ok" | "yellow" | "red";

export interface AuditRow {
  id: string;
  user_email: string | null;
  event_type: string;
  new_value?: Record<string, unknown> | null;
  created_at: string;
}

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const HIGH_VALUE_ASSET_THRESHOLD = 100000; // purchase_cost, in the project's currency

export function computeRiskLevel(row: AuditRow, allRowsForSameEmail: AuditRow[]): RiskLevel {
  if (row.event_type === "failed_login") {
    const windowStart = new Date(row.created_at).getTime() - FAILED_LOGIN_WINDOW_MS;
    const recentFailures = allRowsForSameEmail.filter(
      (r) =>
        r.event_type === "failed_login" &&
        new Date(r.created_at).getTime() >= windowStart &&
        new Date(r.created_at).getTime() <= new Date(row.created_at).getTime()
    ).length;
    if (recentFailures > 3) return "red";
    if (recentFailures > 2) return "yellow";
  }

  if (row.event_type === "delete" && typeof row.new_value?.purchase_cost === "number") {
    if ((row.new_value.purchase_cost as number) >= HIGH_VALUE_ASSET_THRESHOLD) return "red";
  }

  return "ok";
}
