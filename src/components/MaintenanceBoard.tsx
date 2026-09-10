"use client";

import { useEffect, useState } from "react";

interface Machine {
  id: string;
  equipment_name: string;
  next_maintenance_date: string | null;
  status: string;
}
interface Complaint {
  id: string;
  complaint_text: string;
  reporter_name: string;
  status: string;
  reported_at: string;
  machine: { equipment_name: string } | null;
}

// Two views under one page (Machines / Complaints), matching the old
// system's PM module being one cohesive area rather than two separate
// nav items. Complaints reported via the public QR-scan route
// (app/api/maintenance/scan/[id]) show up here identically to ones
// reported through this in-app inbox — same table, same view.
export function MaintenanceBoard() {
  const [tab, setTab] = useState<"machines" | "complaints">("machines");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load() {
    setLoading(true);
    if (tab === "machines") {
      const res = await fetch("/api/maintenance/machines");
      setMachines((await res.json()).data ?? []);
    } else {
      const res = await fetch("/api/maintenance/complaints");
      setComplaints((await res.json()).data ?? []);
    }
    setLoading(false);
  }

  async function markResolved(id: string) {
    const notes = prompt("Technician name(s):");
    await fetch(`/api/maintenance/complaints/${id}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", resolved_technician_names: notes ? [notes] : [] }),
    });
    load();
  }

  const isOverdue = (date: string | null) => !!date && new Date(date) < new Date();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Preventive Maintenance</h1>
      <p className="mb-5 text-sm text-ink-600">Schedules, reminders, and the complaint inbox.</p>

      <div className="mb-5 flex gap-1">
        {(["machines", "complaints"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm capitalize ${
              tab === t ? "bg-navy-900 text-white" : "bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : tab === "machines" ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs text-ink-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Equipment</th>
                <th className="px-5 py-2.5 font-medium">Next maintenance</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {machines.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5 text-ink-900">{m.equipment_name}</td>
                  <td className={`px-5 py-2.5 ${isOverdue(m.next_maintenance_date) ? "font-medium text-attention" : "text-ink-600"}`}>
                    {m.next_maintenance_date ?? "—"} {isOverdue(m.next_maintenance_date) && "(overdue)"}
                  </td>
                  <td className="px-5 py-2.5 text-ink-600">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <div key={c.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">{c.machine?.equipment_name}</p>
                <p className="text-sm text-ink-600">{c.complaint_text}</p>
                <p className="mt-1 text-xs text-ink-400">
                  {c.reporter_name} · {new Date(c.reported_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`badge ${
                    c.status === "resolved" ? "bg-success-bg text-success" : c.status === "in_progress" ? "bg-attention-bg text-attention" : "bg-danger-bg text-danger"
                  }`}
                >
                  {c.status.replace("_", " ")}
                </span>
                {c.status !== "resolved" && (
                  <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => markResolved(c.id)}>
                    Mark done
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
