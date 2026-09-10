import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { redirect } from "next/navigation";
import { type LucideIcon, ArrowUpRight, Boxes, ClipboardCheck, ShieldAlert } from "lucide-react";

// Server component: all the counts below run as the signed-in user via
// RLS (see 006_rls_policies.sql), so an Admin scoped to one plant sees
// only their own numbers here without this page doing any scoping
// itself â€” same principle as every API route built earlier.
export default async function DashboardPage() {
  const supabase = await createServerSupabase();

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
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="page-heading">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">Operations / overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-950">Asset command center</h1>
          <p className="mt-1 text-sm text-ink-600">A live view of your equipment estate and current exposure.</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Updated just now</p>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Total assets" value={total} tone="navy" icon={Boxes} />
        <StatCard label="Assigned / in use" value={counts.assigned ?? 0} tone="accent" icon={ArrowUpRight} />
        <StatCard label="Available" value={counts.available ?? 0} tone="success" icon={ClipboardCheck} />
        <StatCard label="Maintenance" value={counts.maintenance ?? 0} tone="attention" icon={ShieldAlert} />
        <StatCard label="Scrapped" value={counts.scrapped ?? 0} tone="danger" icon={ShieldAlert} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Inventory distribution</p><h2 className="mt-1 text-base font-semibold text-navy-950">Category summary</h2></div>
          <span className="badge bg-success-bg text-success">Live</span>
        </div>
        <div className="grid grid-cols-1 gap-px bg-surface-border sm:grid-cols-2 lg:grid-cols-3">
          {categorySummaries.map((cat) => (
            <div key={cat.id} className="bg-white px-5 py-4 transition-colors hover:bg-surface-muted">
              <div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-ink-400">{cat.name}</p><ArrowUpRight size={14} className="text-ink-400" /></div>
              <p className="mt-2 text-2xl font-semibold text-navy-950">{cat.count}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${total ? Math.max(5, Math.round((cat.count / total) * 100)) : 5}%` }} /></div>
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
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "navy" | "accent" | "success" | "attention" | "danger";
  icon: LucideIcon;
}) {
  const toneClasses: Record<typeof tone, string> = {
    navy: "text-navy-800",
    accent: "text-accent",
    success: "text-success",
    attention: "text-attention",
    danger: "text-danger",
  };
  return (
    <div className="card stat-strip px-4 py-4 sm:px-5">
      <div className="relative z-10 flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-ink-400">{label}</p><Icon size={16} className={toneClasses[tone]} /></div>
      <p className={`relative z-10 mt-2 text-3xl font-semibold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}
