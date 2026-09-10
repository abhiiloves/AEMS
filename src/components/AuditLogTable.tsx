"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToAuditLogs } from "@/lib/realtime/auditLogs";

interface LogRow {
  id: string;
  user_email: string | null;
  user_role: string | null;
  event_category: "session" | "data_change";
  event_type: string;
  table_name: string | null;
  ip_address: string | null;
  approx_location: string | null;
  session_duration: string | null;
  created_at: string;
  risk_level: "ok" | "yellow" | "red";
}

// risk_level yellow/red rows are the >2/>3 failed-login + high-value-
// delete thresholds from lib/auditRisk.ts — computed server-side so
// this component never re-derives the rule.
export function AuditLogTable({ canExport, isItAdmin }: { canExport: boolean; isItAdmin: boolean }) {
  const [category, setCategory] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, role]);

  useEffect(() => {
    if (!isItAdmin) return;
    const supabase = createClient();
    const { unsubscribe } = subscribeToAuditLogs(supabase, "it_admin", (row) => {
      setRows((prev) => [{ ...row, risk_level: "ok" } as LogRow, ...prev].slice(0, 50));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isItAdmin]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (role) params.set("role", role);
    const res = await fetch(`/api/audit-logs?${params}`);
    const data = await res.json();
    setRows(data.data ?? []);
    setLoading(false);
  }

  const rowStyle = (risk: LogRow["risk_level"]) =>
    risk === "red" ? "border-l-2 border-danger bg-danger-bg/40" : risk === "yellow" ? "border-l-2 border-attention bg-attention-bg/40" : "";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Audit Logs</h1>
          {isItAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <select className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="session">Session</option>
            <option value="data_change">Data change</option>
          </select>
          <select className="input !w-auto" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="hr">HR</option>
            <option value="admin">Admin</option>
            <option value="it_admin">IT Admin</option>
          </select>
          {canExport && (
            <a href="/api/audit-logs/export" className="btn-secondary">
              <Download size={15} /> Export
            </a>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs text-ink-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">User</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-4 py-2.5 font-medium">Table</th>
                <th className="px-4 py-2.5 font-medium">IP / Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map((r) => (
                <tr key={r.id} className={rowStyle(r.risk_level)}>
                  <td className="px-4 py-2 text-ink-600">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-ink-900">{r.user_email ?? "unknown"}</td>
                  <td className="px-4 py-2 uppercase text-ink-600">{r.user_role?.replace("_", " ") ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-900">{r.event_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 text-ink-600">{r.table_name ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-600">
                    {r.ip_address ?? "—"} {r.approx_location ? `· ${r.approx_location}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
