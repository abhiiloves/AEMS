"use client";

import { useEffect, useState } from "react";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  status: string;
  frequency: string;
  template: { name: string } | null;
}

// Read-focused list for this pass — the automation editor (recipient
// rules, schedule builder, consolidation-mode picker) is real UI work
// on its own and is listed as remaining work rather than half-built
// here. Status toggle (active/paused) is the one write action wired up.
export function EmailAutomationBoard() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/email-automations");
    const data = await res.json();
    setAutomations(data.data ?? []);
    setLoading(false);
  }

  async function toggleStatus(a: Automation) {
    await fetch(`/api/settings/email-automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: a.status === "active" ? "paused" : "active" }),
    });
    load();
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Email Automation</h1>
      <p className="mb-5 text-sm text-ink-600">PM reminders and complaint notifications.</p>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : automations.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-400">No automations configured yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs text-ink-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Trigger</th>
                <th className="px-5 py-2.5 font-medium">Frequency</th>
                <th className="px-5 py-2.5 font-medium">Template</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {automations.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-2.5 text-ink-900">{a.name}</td>
                  <td className="px-5 py-2.5 text-ink-600">{a.trigger_type.replace(/_/g, " ")}</td>
                  <td className="px-5 py-2.5 text-ink-600 capitalize">{a.frequency}</td>
                  <td className="px-5 py-2.5 text-ink-600">{a.template?.name ?? "—"}</td>
                  <td className="px-5 py-2.5">
                    <button
                      onClick={() => toggleStatus(a)}
                      className={`badge ${a.status === "active" ? "bg-success-bg text-success" : "bg-ink-900/5 text-ink-400"}`}
                    >
                      {a.status}
                    </button>
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
