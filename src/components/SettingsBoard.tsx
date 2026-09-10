"use client";

import { useEffect, useState } from "react";
<<<<<<< HEAD
=======
import { ChevronDown, ChevronUp, Plus, Trash2, Pencil, Check, X } from "lucide-react";
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592

interface Row {
  id: string;
  name: string;
<<<<<<< HEAD
=======
  location_id?: string | null;
  plant_id?: string | null;
  admin_user_id?: string | null;
  admin?: { id: string; email: string } | null;
}
interface SubDepartment {
  id: string;
  name: string;
  department_id: string;
}
interface UserOption {
  id: string;
  email: string;
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
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
<<<<<<< HEAD
export function SettingsBoard({ isItAdmin }: { isItAdmin: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("locations");
  const [rows, setRows] = useState<Row[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
=======
//
// Plants now link to a Location, Departments now link to a Plant, and
// each Department can hold its own Sub-departments — added per
// 014_department_hierarchy.sql (see that migration for why: department
// access is now scopable down to sub-department, not just plant).
export function SettingsBoard({ isItAdmin }: { isItAdmin: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("locations");
  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [plants, setPlants] = useState<Row[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [newParentId, setNewParentId] = useState(""); // location_id for plants, plant_id for departments
  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [newSubDeptName, setNewSubDeptName] = useState("");
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
  const [loading, setLoading] = useState(true);

  const current = TABS.find((t) => t.key === tab)!;

  useEffect(() => {
    load();
<<<<<<< HEAD
=======
    // locations/plants are needed as dropdown options on other tabs
    // too (Plants needs Locations, Departments needs Plants), so keep
    // them loaded regardless of which tab is active.
    fetch("/api/settings/locations")
      .then((r) => r.json())
      .then((d) => setLocations(d.data ?? []));
    fetch("/api/settings/plants")
      .then((r) => r.json())
      .then((d) => setPlants(d.data ?? []));
    if (tab === "departments") {
      fetch("/api/settings/sub-departments")
        .then((r) => r.json())
        .then((d) => setSubDepartments(d.data ?? []));
      if (isItAdmin) {
        fetch("/api/users")
          .then((r) => r.json())
          .then((d) => setUsers((d.data ?? []).filter((u: { is_active: boolean }) => u.is_active)));
      }
    }
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load() {
    setLoading(true);
    const res = await fetch(current.endpoint);
    const data = await res.json();
    setRows(data.data ?? []);
    setLoading(false);
  }

<<<<<<< HEAD
=======
  async function loadSubDepartments() {
    const res = await fetch("/api/settings/sub-departments");
    const data = await res.json();
    setSubDepartments(data.data ?? []);
  }

>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { name: newName };
    if (tab === "categories") body.code_prefix = newPrefix;
<<<<<<< HEAD
=======
    if (tab === "plants") body.location_id = newParentId || null;
    if (tab === "departments") body.plant_id = newParentId || null;
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
    await fetch(current.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setNewName("");
    setNewPrefix("");
<<<<<<< HEAD
    load();
  }

=======
    setNewParentId("");
    load();
  }

  async function addSubDepartment(departmentId: string) {
    if (!newSubDeptName.trim()) return;
    await fetch("/api/settings/sub-departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubDeptName, department_id: departmentId }),
    });
    setNewSubDeptName("");
    loadSubDepartments();
  }

  async function removeSubDepartment(id: string) {
    await fetch(`/api/settings/sub-departments/${id}`, { method: "DELETE" });
    loadSubDepartments();
  }

  async function assignDepartmentAdmin(departmentId: string, userId: string) {
    await fetch(`/api/settings/departments/${departmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_user_id: userId || null }),
    });
    load();
  }

  async function renameDepartment(departmentId: string, name: string) {
    if (!name.trim()) return;
    await fetch(`/api/settings/departments/${departmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setEditingDeptId(null);
    load();
  }

  async function deleteDepartment(departmentId: string, name: string) {
    if (!confirm(`Delete department "${name}"? This can't be undone, and will fail if anything is still linked to it.`)) return;
    const res = await fetch(`/api/settings/departments/${departmentId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error);
      return;
    }
    load();
  }

  const locationName = (id?: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const plantName = (id?: string | null) => plants.find((p) => p.id === id)?.name ?? "—";

>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
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
<<<<<<< HEAD
          <form onSubmit={add} className="mb-5 flex items-end gap-3">
=======
          <form onSubmit={add} className="mb-5 flex flex-wrap items-end gap-3">
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
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
<<<<<<< HEAD
=======
            {tab === "plants" && (
              <div>
                <label className="label">Location</label>
                <select className="input" value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
                  <option value="">— Select location —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {tab === "departments" && (
              <div>
                <label className="label">Plant</label>
                <select className="input" value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
                  <option value="">— Select plant —</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
            <button type="submit" className="btn-primary">
              Add
            </button>
          </form>
        )}
        {!isItAdmin && <p className="mb-4 text-sm text-ink-400">Only IT Admin can add or edit entries — showing read-only list.</p>}

        {loading ? (
          <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
<<<<<<< HEAD
=======
        ) : tab === "departments" ? (
          <ul className="divide-y divide-surface-border">
            {rows.map((r) => {
              const subs = subDepartments.filter((s) => s.department_id === r.id);
              const isOpen = expandedDeptId === r.id;
              return (
                <li key={r.id} className="py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    {editingDeptId === r.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          className="input"
                          value={editingDeptName}
                          onChange={(e) => setEditingDeptName(e.target.value)}
                          autoFocus
                        />
                        <button className="text-success" onClick={() => renameDepartment(r.id, editingDeptName)}>
                          <Check size={16} />
                        </button>
                        <button className="text-ink-400" onClick={() => setEditingDeptId(null)}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <span className="text-ink-900">{r.name}</span>
                        <span className="ml-2 text-xs text-ink-400">{plantName(r.plant_id)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      {isItAdmin && editingDeptId !== r.id && (
                        <>
                          <button
                            className="text-ink-400 hover:text-accent"
                            title="Rename"
                            onClick={() => {
                              setEditingDeptId(r.id);
                              setEditingDeptName(r.name);
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button className="text-ink-400 hover:text-danger" title="Delete" onClick={() => deleteDepartment(r.id, r.name)}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      <button
                        className="flex items-center gap-1 text-xs text-accent hover:underline"
                        onClick={() => setExpandedDeptId(isOpen ? null : r.id)}
                      >
                        {subs.length} sub-dept{subs.length === 1 ? "" : "s"} {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-2 rounded bg-surface-muted p-3">
                      <div className="mb-3 flex items-end gap-2">
                        <div className="flex-1">
                          <label className="label">Department admin (gets edit access to this department + its sub-depts)</label>
                          {isItAdmin ? (
                            <select
                              className="input"
                              value={r.admin_user_id ?? ""}
                              onChange={(e) => assignDepartmentAdmin(r.id, e.target.value)}
                            >
                              <option value="">— None assigned —</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-ink-700">{r.admin?.email ?? "None assigned"}</p>
                          )}
                        </div>
                      </div>
                      {subs.length > 0 && (
                        <ul className="mb-3 space-y-1.5">
                          {subs.map((s) => (
                            <li key={s.id} className="flex items-center justify-between rounded bg-white px-3 py-1.5 text-sm">
                              <span className="text-ink-700">{s.name}</span>
                              {isItAdmin && (
                                <button className="text-ink-400 hover:text-danger" onClick={() => removeSubDepartment(s.id)}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {isItAdmin && (
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="label">Add sub-department to {r.name}</label>
                            <input
                              className="input"
                              placeholder="e.g. Quality Control"
                              value={newSubDeptName}
                              onChange={(e) => setNewSubDeptName(e.target.value)}
                            />
                          </div>
                          <button className="btn-secondary" onClick={() => addSubDepartment(r.id)}>
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
        ) : (
          <ul className="divide-y divide-surface-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink-900">{r.name}</span>
<<<<<<< HEAD
=======
                {tab === "plants" && <span className="text-xs text-ink-400">{locationName(r.location_id)}</span>}
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
