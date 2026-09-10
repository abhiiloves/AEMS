"use client";

import { useEffect, useState } from "react";
import { Plus, Ban } from "lucide-react";

interface Lookup {
  id: string;
  name: string;
}
interface Scope {
  id: string;
  location_id: string | null;
  plant_id: string | null;
  category_id: string | null;
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
// additions on top: per-user can_bulk_import/can_export toggles, and
// the "global read-only Admin" is just a scope row with everything set
// to "All" + can_edit off — no separate role in the picker below.
export function UserManagementBoard({
  currentUserRole,
  categories,
  locations,
  plants,
}: {
  currentUserRole: string;
  categories: Lookup[];
  locations: Lookup[];
  plants: Lookup[];
}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [error, setError] = useState<string | null>(null);

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

  const scopeLabel = (scope: Scope[]) => {
    if (scope.length === 0) return "None";
    if (scope.some((s) => !s.location_id && !s.plant_id && !s.category_id)) {
      return scope[0].can_edit ? "All (edit)" : "All (read-only)";
    }
    const cats = [...new Set(scope.map((s) => categories.find((c) => c.id === s.category_id)?.name).filter(Boolean))];
    return cats.join(", ") || "Scoped";
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
                <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
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
                    {u.is_active && (
                      <button className="text-ink-400 hover:text-danger" title="Disable" onClick={() => disableUser(u)}>
                        <Ban size={15} />
                      </button>
                    )}
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
