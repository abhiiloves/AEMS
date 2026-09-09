"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Employee {
  id: string;
  full_name: string;
  employee_code: string;
  corporate_email: string;
  is_active: boolean;
  assigned_asset_count: number;
}

export function EmployeeDirectory() {
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function load() {
    if (query.length > 0 && query.length < 2) return;
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/employees${params}`);
    const data = await res.json();
    setEmployees(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Employees</h1>
          <p className="text-sm text-ink-600">{total} total registered</p>
        </div>
        <input className="input max-w-xs" placeholder="Search by name or ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {employees.map((emp) => (
            <Link key={emp.id} href={`/employees/${emp.id}`} className="card p-4 hover:border-accent">
              <p className="text-xs text-ink-400">{emp.employee_code}</p>
              <p className="text-sm font-semibold text-ink-900">{emp.full_name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-600">{emp.corporate_email}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="badge bg-accent/10 text-accent">
                  {emp.assigned_asset_count} asset{emp.assigned_asset_count === 1 ? "" : "s"}
                </span>
                <span className={`badge ${emp.is_active ? "bg-success-bg text-success" : "bg-ink-900/5 text-ink-400"}`}>
                  {emp.is_active ? "active" : "inactive"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
