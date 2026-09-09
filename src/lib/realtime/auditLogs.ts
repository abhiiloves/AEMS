import type { SupabaseClient } from "@supabase/supabase-js";

// Realtime refresh is IT-Admin-only per project decision (Admin still
// gets the list + export, just not the live stream or the highlight
// rules — those two stay IT-Admin-only). Postgres changes still go
// through the audit_select RLS policy, so even if this were called for
// an Admin they'd only ever receive rows already in their own scope —
// this helper enforces the IT-Admin-only rule at the call site anyway,
// so the "Live" toggle simply doesn't render for anyone else.
export function subscribeToAuditLogs(
  supabase: SupabaseClient,
  callerRole: string,
  onNewRow: (row: Record<string, unknown>) => void
) {
  if (callerRole !== "it_admin") return { unsubscribe: () => {} };

  const channel = supabase
    .channel("audit-logs-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (payload) => {
      onNewRow(payload.new);
    })
    .subscribe();

  return { unsubscribe: () => supabase.removeChannel(channel) };
}
