"use client";

import { useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
}

const TABS = [
  { key: "locations", label: "Locations", endpoint: "/api/settings/locations" },
  { key: "plants", label: "Plants", endpoint: "/api/settings/plants" },
  { key: "categories", label: "Dynamic Categories & Form Fields", endpoint: "/api/settings/categories" },
  { key: "departments", label: "Departments", endpoint: "/api/settings/departments" },
] as const;

// Mirrors the old system's Settings tabs (Locations | Plants | Dynamic
// Categories & Form Fields | Audit Logs) — Audit Logs has its own full
// page (app/audit-logs) rather than living inside Settings here, since
// it needed real-time + export + risk highlighting that outgrew a tab.
export function SettingsBoard({ isItAdmin }: { isItAdmin: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("locations");
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [loading, setLoading] = useState(true);

  const current = TABS.find((t) => t.key === tab)!;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load() {
    setLoading(true);
    const res = await fetch(current.endpoint);
    const data = await res.json();
    setRows(data.data ?? []);
    setLoading(false);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { name: newName };
    if (tab === "categories") body.code_prefix = newPrefix;
    await fetch(current.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setNewName("");
    setNewPrefix("");
    load();
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Settings</h1>
      <p className="mb-5 text-sm text-ink-600">Manage locations, plant codes, dynamic categories, and departments.</p>

      <div className="mb-5 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              tab === t.key ? "bg-navy-900 text-white" : "bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {isItAdmin && (
          <form onSubmit={add} className="mb-5 flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Add {current.label.split(" ")[0]}</label>
              <input className="input" placeholder="e.g. Corporate HQ" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            {tab === "categories" && (
              <div>
                <label className="label">Code prefix</label>
                <input className="input w-28" placeholder="IT" value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} required />
              </div>
            )}
            <button type="submit" className="btn-primary">
              Add
            </button>
          </form>
        )}
        {!isItAdmin && <p className="mb-4 text-sm text-ink-400">Only IT Admin can add or edit entries — showing read-only list.</p>}

        {loading ? (
          <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-900">{r.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
