import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { redirect } from "next/navigation";

// Server component: all the counts below run as the signed-in user via
// RLS (see 006_rls_policies.sql), so an Admin scoped to one plant sees
// only their own numbers here without this page doing any scoping
// itself — same principle as every API route built earlier.
export default async function DashboardPage() {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  const statusCounts = await Promise.all(
    (["available", "assigned", "maintenance", "scrapped"] as const).map(async (status) => {
      const { count } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("status", status)
        .eq("is_deleted", false);
      return [status, count ?? 0] as const;
    })
  );
  const counts = Object.fromEntries(statusCounts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const { data: categories } = await supabase.from("asset_categories").select("id, name").eq("is_functional_module", false);
  const categorySummaries = await Promise.all(
    (categories ?? []).map(async (cat) => {
      const { count } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("category_id", cat.id)
        .eq("is_deleted", false);
      return { ...cat, count: count ?? 0 };
    })
  );

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Assets" value={total} tone="navy" />
        <StatCard label="Assigned / In Use" value={counts.assigned ?? 0} tone="accent" />
        <StatCard label="Available" value={counts.available ?? 0} tone="success" />
        <StatCard label="Maintenance" value={counts.maintenance ?? 0} tone="attention" />
        <StatCard label="Scrapped" value={counts.scrapped ?? 0} tone="danger" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Category summary</h2>
        </div>
        <div className="grid grid-cols-1 gap-px bg-surface-border sm:grid-cols-2 lg:grid-cols-3">
          {categorySummaries.map((cat) => (
            <div key={cat.id} className="bg-white px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{cat.name}</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{cat.count}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "navy" | "accent" | "success" | "attention" | "danger";
}) {
  const toneClasses: Record<typeof tone, string> = {
    navy: "text-navy-800",
    accent: "text-accent",
    success: "text-success",
    attention: "text-attention",
    danger: "text-danger",
  };
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}
