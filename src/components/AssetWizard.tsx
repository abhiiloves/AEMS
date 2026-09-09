"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

interface Lookup {
  id: string;
  name: string;
}
interface CategoryField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
}

const STEPS = ["Select Asset", "Asset Details", "Assignment"] as const;

// Deliberately kept to 3 steps like the old system's wizard, even
// though this project's schema doesn't have the old system's separate
// "device sub-type" concept (Laptop/Desktop/Input-Output under IT
// Assets) — that distinction lives in category_form_fields per
// category now instead of a second selection level, which is why step
// 1 here is a single category picker rather than category+sub-type.
export function AssetWizard({
  categories,
  departments,
  locations,
  plants,
}: {
  categories: (Lookup & { code_prefix: string })[];
  departments: Lookup[];
  locations: Lookup[];
  plants: (Lookup & { location_id: string | null })[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([]);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [condition, setCondition] = useState("existing_asset");
  const [vendorName, setVendorName] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");

  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState<{ id: string; full_name: string; employee_code: string }[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [assignedDate, setAssignedDate] = useState("");

  useEffect(() => {
    if (!categoryId) return;
    fetch(`/api/settings/categories/${categoryId}/fields`)
      .then((r) => r.json())
      .then((d) => setCategoryFields(d.data ?? []));
  }, [categoryId]);

  useEffect(() => {
    if (employeeQuery.length < 2) {
      setEmployeeResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/employees?q=${encodeURIComponent(employeeQuery)}`)
        .then((r) => r.json())
        .then((d) => setEmployeeResults(d.data ?? []));
    }, 300);
    return () => clearTimeout(handle);
  }, [employeeQuery]);

  async function submit() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: categoryId,
        brand,
        model,
        serial_no: serialNo,
        condition,
        vendor_name: vendorName || null,
        po_number: poNumber || null,
        purchase_date: purchaseDate || null,
        purchase_cost: purchaseCost ? Number(purchaseCost) : null,
        department_id: departmentId || null,
        location_id: locationId || null,
        plant_id: plantId || null,
        custom_fields: customFields,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaving(false);
      setError(data.error ?? "Could not register asset");
      return;
    }

    if (employeeId) {
      await fetch(`/api/assets/${data.data.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, condition_at_assignment: condition }),
      });
    }

    router.push(`/assets/${data.data.id}`);
  }

  const canGoNext =
    (step === 0 && categoryId) || (step === 1 && brand && model && serialNo) || step === 2;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Register New Asset</h1>
      <p className="mb-6 text-sm text-ink-600">Select department and asset type, then complete details and assignment.</p>

      <div className="mb-6 flex overflow-hidden rounded-lg border border-surface-border">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex flex-1 items-center gap-2 px-4 py-2.5 text-sm ${
              i === step ? "bg-white font-medium text-accent" : i < step ? "bg-surface-muted text-success" : "bg-surface-muted text-ink-400"
            } ${i > 0 ? "border-l border-surface-border" : ""}`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                i < step ? "bg-success text-white" : i === step ? "bg-accent text-white" : "bg-white text-ink-400"
              }`}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {step === 0 && (
          <div>
            <label className="label">Main Category</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Brand / Make *</label>
                <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} required />
              </div>
              <div>
                <label className="label">Model *</label>
                <input className="input" value={model} onChange={(e) => setModel(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Condition *</label>
                <select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
                  <option value="existing_asset">Existing Asset</option>
                  <option value="new_asset">New Asset</option>
                </select>
              </div>
              <div>
                <label className="label">Serial Number *</label>
                <input className="input" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} required />
              </div>
            </div>

            {categoryFields.length > 0 && (
              <div className="rounded-md bg-surface-muted p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">Category-specific fields</p>
                <div className="grid grid-cols-2 gap-4">
                  {categoryFields.map((f) => (
                    <div key={f.id}>
                      <label className="label">
                        {f.field_label}
                        {f.is_required && " *"}
                      </label>
                      <input
                        className="input"
                        value={customFields[f.field_name] ?? ""}
                        onChange={(e) => setCustomFields((prev) => ({ ...prev, [f.field_name]: e.target.value }))}
                        required={f.is_required}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Vendor Name</label>
                <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
              </div>
              <div>
                <label className="label">PO Number</label>
                <input className="input" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </div>
              <div>
                <label className="label">Purchase Date</label>
                <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Purchase Cost</label>
                <input type="number" className="input" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-md bg-surface-muted p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-400">Employee mapping (optional)</p>
              <input
                className="input"
                placeholder="Search employee by name or ID…"
                value={employeeQuery}
                onChange={(e) => setEmployeeQuery(e.target.value)}
              />
              {employeeResults.length > 0 && (
                <div className="mt-2 divide-y divide-surface-border rounded-md border border-surface-border bg-white">
                  {employeeResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                        employeeId === emp.id ? "bg-accent/10" : ""
                      }`}
                      onClick={() => {
                        setEmployeeId(emp.id);
                        setEmployeeQuery(emp.full_name);
                        setEmployeeResults([]);
                      }}
                    >
                      {emp.full_name} <span className="text-ink-400">· {emp.employee_code}</span>
                    </button>
                  ))}
                </div>
              )}
              {employeeId && (
                <div className="mt-3">
                  <label className="label">Assigned Date</label>
                  <input type="date" className="input" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
                </div>
              )}
            </div>

            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-400">Location & Plant</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Department</label>
                <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                  <option value="">Select…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Location</label>
                <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Select…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Plant</label>
                <select className="input" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
                  <option value="">Select…</option>
                  {plants
                    .filter((p) => !locationId || p.location_id === locationId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex items-center justify-between border-t border-surface-border pt-4">
          <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" disabled={!canGoNext} onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
              {saving ? "Registering…" : "Register Asset"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
