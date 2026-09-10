import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { AssetActions } from "@/components/AssetActions";
import { redirect, notFound } from "next/navigation";

// The assignment-history table here is the same free-report shown
// earlier in the project ("kis-kis ko assign hua") — no separate
// reporting table was needed because assignment is history-driven.
export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  const { data: asset } = await supabase
    .from("assets")
    .select("*, category:category_id ( name )")
    .eq("id", params.id)
    .single();
  if (!asset) notFound();

  const { data: history } = await supabase
    .from("asset_assignment_history")
    .select("id, assigned_on, returned_on, condition_at_assignment, condition_at_return, employee:employee_id ( full_name, employee_code )")
    .eq("asset_id", params.id)
    .order("assigned_on", { ascending: false });

  const current = history?.find((h) => h.returned_on === null);

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-mono text-sm text-ink-400">{asset.asset_code}</p>
            <h1 className="text-xl font-semibold text-ink-900">
              {asset.brand} {asset.model}
            </h1>
            <p className="text-sm text-ink-600">{asset.category?.name}</p>
          </div>
          <span className="badge bg-accent/10 text-accent capitalize">{asset.status}</span>
        </div>

        <AssetActions assetId={asset.id} currentAssignmentId={current?.id ?? null} status={asset.status} />

        <div className="card mt-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Asset details</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-400">Serial number</dt>
            <dd className="text-ink-900">{asset.serial_no ?? "—"}</dd>
            <dt className="text-ink-400">Vendor</dt>
            <dd className="text-ink-900">{asset.vendor_name ?? "—"}</dd>
            <dt className="text-ink-400">Purchase cost</dt>
            <dd className="text-ink-900">{asset.purchase_cost ?? "—"}</dd>
            <dt className="text-ink-400">Warranty</dt>
            <dd className="text-ink-900">
              {asset.warranty_start ?? "—"} → {asset.warranty_end ?? "—"}
            </dd>
          </dl>
        </div>

        <div className="card mt-6">
          <h2 className="border-b border-surface-border px-5 py-3 text-sm font-semibold text-ink-900">Assignment history</h2>
          {history && history.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-ink-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Employee</th>
                  <th className="px-5 py-2 font-medium">Assigned on</th>
                  <th className="px-5 py-2 font-medium">Returned on</th>
                  <th className="px-5 py-2 font-medium">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-5 py-2.5 text-ink-900">
                      {h.employee?.full_name} <span className="text-ink-400">· {h.employee?.employee_code}</span>
                    </td>
                    <td className="px-5 py-2.5 text-ink-600">{new Date(h.assigned_on).toLocaleDateString()}</td>
                    <td className="px-5 py-2.5 text-ink-600">{h.returned_on ? new Date(h.returned_on).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-2.5 text-ink-600">
                      {h.condition_at_assignment ?? "—"} {h.condition_at_return ? `→ ${h.condition_at_return}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-6 text-center text-sm text-ink-400">This asset has never been assigned.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
