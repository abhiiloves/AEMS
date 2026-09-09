"use client";

import { useEffect, useState, Fragment } from "react";
import { Plus, Ban, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Lookup {
  id: string;
  name: string;
}
interface Plant extends Lookup {
  location_id: string | null;
}
interface Department extends Lookup {
  plant_id: string | null;
}
interface SubDepartment extends Lookup {
  department_id: string;
}
interface Scope {
  id: string;
  location_id: string | null;
  plant_id: string | null;
  category_id: string | null;
  department_id: string | null;
  sub_department_id: string | null;
  can_edit: boolean;
}
interface AppUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  can_bulk_import: boolean;
  can_export: boolean;
  user_scope: Scope[];
}

// Mirrors the old system's User Management table (Email | Role |
// Locations | Plants | Categories | Actions), plus the project's
// additions on top: per-user can_bulk_import/can_export toggles, the
// "global read-only Admin" (a scope row with everything set to "All" +
// can_edit off — no separate role), and — new — Plant -> Department ->
// Sub-department scoping so IT Admin can restrict a user down to one
// sub-department, not just one plant (014_department_hierarchy.sql).
export function UserManagementBoard({
  currentUserRole,
  categories,
  locations,
  plants,
  departments,
  subDepartments,
}: {
  currentUserRole: string;
  categories: Lookup[];
  locations: Lookup[];
  plants: Plant[];
  departments: Department[];
  subDepartments: SubDepartment[];
}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.data ?? []);
    setLoading(false);
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setShowAdd(false);
    setNewEmail("");
    load();
  }

  async function toggleFlag(u: AppUser, flag: "can_bulk_import" | "can_export") {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [flag]: !u[flag] }),
    });
    load();
  }

  async function disableUser(u: AppUser) {
    if (!confirm(`Disable ${u.email}?`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    load();
  }

  const nameOf = (list: Lookup[], id: string | null) => (id ? list.find((l) => l.id === id)?.name : null);

  const scopeLabel = (scope: Scope[]) => {
    if (scope.length === 0) return "None";
    const globalScope = scope.find((s) => !s.location_id && !s.plant_id && !s.category_id && !s.department_id && !s.sub_department_id);
    if (globalScope) {
      return globalScope.can_edit ? "All (edit)" : "All (read-only)";
    }
    const labels = scope.map((s) => {
      const parts = [
        nameOf(plants, s.plant_id),
        nameOf(departments, s.department_id),
        nameOf(subDepartments, s.sub_department_id),
        nameOf(categories, s.category_id),
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" / ") : "Scoped";
    });
    return [...new Set(labels)].join(", ");
  };

  const assignableRoles =
    currentUserRole === "it_admin" ? ["user", "hr", "admin", "it_admin"] : currentUserRole === "admin" ? ["user", "hr"] : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">User Management</h1>
          <p className="text-sm text-ink-600">{users.length} users</p>
        </div>
        {assignableRoles.length > 0 && (
          <button className="btn-primary" onClick={() => setShowAdd((s) => !s)}>
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={addUser} className="card mb-5 flex items-end gap-3 p-4">
          <div className="flex-1">
            <label className="label">Email</label>
            <input type="email" required className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </form>
      )}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs text-ink-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 font-medium">Role</th>
                <th className="px-5 py-2.5 font-medium">Scope</th>
                <th className="px-5 py-2.5 font-medium">Bulk import</th>
                <th className="px-5 py-2.5 font-medium">Export</th>
                <th className="px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {users.map((u) => (
                <Fragment key={u.id}>
                  <tr className={!u.is_active ? "opacity-50" : ""}>
                    <td className="px-5 py-2.5 text-ink-900">{u.email}</td>
                    <td className="px-5 py-2.5 uppercase text-ink-600">{u.role.replace("_", " ")}</td>
                    <td className="px-5 py-2.5 text-ink-600">{scopeLabel(u.user_scope ?? [])}</td>
                    <td className="px-5 py-2.5">
                      {(u.role === "admin" || u.role === "it_admin") && currentUserRole === "it_admin" ? (
                        <input type="checkbox" checked={u.can_bulk_import} onChange={() => toggleFlag(u, "can_bulk_import")} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {(u.role === "admin" || u.role === "it_admin") && currentUserRole === "it_admin" ? (
                        <input type="checkbox" checked={u.can_export} onChange={() => toggleFlag(u, "can_export")} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        {currentUserRole === "it_admin" && (
                          <button
                            className="flex items-center gap-1 text-xs text-accent hover:underline"
                            onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                          >
                            Access {expandedUserId === u.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        )}
                        {u.is_active && (
                          <button className="text-ink-400 hover:text-danger" title="Disable" onClick={() => disableUser(u)}>
                            <Ban size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedUserId === u.id && (
                    <tr>
                      <td colSpan={6} className="bg-surface-muted px-5 py-4">
                        <ScopeEditor
                          user={u}
                          categories={categories}
                          locations={locations}
                          plants={plants}
                          departments={departments}
                          subDepartments={subDepartments}
                          onChanged={load}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Plant -> Department -> Sub-department is a cascade: picking a Plant
// narrows the Department options to that plant's departments, picking
// a Department narrows Sub-department options to that department's
// sub-departments. Every field is optional — leaving one blank means
// "unrestricted on that dimension", same NULL convention as the RLS
// side (has_scope() in 014_department_hierarchy.sql).
function ScopeEditor({
  user,
  categories,
  locations,
  plants,
  departments,
  subDepartments,
  onChanged,
}: {
  user: AppUser;
  categories: Lookup[];
  locations: Lookup[];
  plants: Plant[];
  departments: Department[];
  subDepartments: SubDepartment[];
  onChanged: () => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [subDepartmentId, setSubDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [canEdit, setCanEdit] = useState(true);
  const [saving, setSaving] = useState(false);

  const plantOptions = locationId ? plants.filter((p) => p.location_id === locationId) : plants;
  const departmentOptions = plantId ? departments.filter((d) => d.plant_id === plantId) : departments;
  const subDepartmentOptions = departmentId ? subDepartments.filter((s) => s.department_id === departmentId) : [];

  const nameOf = (list: Lookup[], id: string | null) => (id ? list.find((l) => l.id === id)?.name ?? "—" : "All");

  async function addScope() {
    setSaving(true);
    await fetch(`/api/users/${user.id}/scope`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: locationId || null,
        plant_id: plantId || null,
        department_id: departmentId || null,
        sub_department_id: subDepartmentId || null,
        category_id: categoryId || null,
        can_edit: canEdit,
      }),
    });
    setLocationId("");
    setPlantId("");
    setDepartmentId("");
    setSubDepartmentId("");
    setCategoryId("");
    setCanEdit(true);
    setSaving(false);
    onChanged();
  }

  async function removeScope(scopeId: string) {
    await fetch(`/api/users/${user.id}/scope?scopeId=${scopeId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Access scope for {user.email}</p>

      {(user.user_scope ?? []).length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {user.user_scope.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded bg-white px-3 py-1.5 text-sm">
              <span className="text-ink-700">
                {nameOf(locations, s.location_id)} / {nameOf(plants, s.plant_id)} / {nameOf(departments, s.department_id)} /{" "}
                {nameOf(subDepartments, s.sub_department_id)} / {nameOf(categories, s.category_id)}{" "}
                <span className="text-ink-400">({s.can_edit ? "edit" : "read-only"})</span>
              </span>
              <button className="text-ink-400 hover:text-danger" onClick={() => removeScope(s.id)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Location</label>
          <select
            className="input"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setPlantId("");
              setDepartmentId("");
              setSubDepartmentId("");
            }}
          >
            <option value="">All</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Plant</label>
          <select
            className="input"
            value={plantId}
            onChange={(e) => {
              setPlantId(e.target.value);
              setDepartmentId("");
              setSubDepartmentId("");
            }}
          >
            <option value="">All</option>
            {plantOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select
            className="input"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setSubDepartmentId("");
            }}
          >
            <option value="">All</option>
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sub-department</label>
          <select className="input" value={subDepartmentId} onChange={(e) => setSubDepartmentId(e.target.value)} disabled={!departmentId}>
            <option value="">All</option>
            {subDepartmentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-sm text-ink-600">
          <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
          Can edit
        </label>
        <button className="btn-primary" disabled={saving} onClick={addScope}>
          <Plus size={14} /> Add scope
        </button>
      </div>
    </div>
  );
}
