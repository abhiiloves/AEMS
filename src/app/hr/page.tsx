import { AppShell } from "@/components/AppShell";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Activity, ArrowUpRight, BriefcaseBusiness, UserCheck, UserRoundX, Users } from "lucide-react";

export default async function HrPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: totalEmployees }, { count: activeStaff }, { count: inactiveRecords }, { count: assetsAssigned }] = await Promise.all([
    supabase.from("employees").select("*", { count: "exact", head: true }),
    supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", false),
    supabase.from("asset_assignment_history").select("*", { count: "exact", head: true }).is("returned_on", null),
  ]);

  const metrics = [
    { label: "Total workforce", value: totalEmployees ?? 0, icon: Users, tone: "text-accent" },
    { label: "Active staff", value: activeStaff ?? 0, icon: UserCheck, tone: "text-success" },
    { label: "Assigned equipment", value: assetsAssigned ?? 0, icon: BriefcaseBusiness, tone: "text-attention" },
    { label: "Inactive records", value: inactiveRecords ?? 0, icon: UserRoundX, tone: "text-danger" },
  ];

  return (
    <AppShell userEmail={user.email ?? ""} userRole="hr">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="page-heading">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400">People / workforce</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-950">HR operations</h1>
          <p className="mt-1 text-sm text-ink-600">Workforce health and equipment accountability at a glance.</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-success"><Activity size={15} /> Data synced</div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div className="card stat-strip px-4 py-5 sm:px-5" key={label}>
            <div className="relative z-10 flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-ink-400">{label}</p><Icon size={17} className={tone} /></div>
            <p className={`relative z-10 mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="card p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Accountability board</p>
          <h2 className="mt-1 text-lg font-semibold text-navy-950">People and equipment stay connected</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">Open the employee directory to inspect current assignments, historical returns, and the person responsible for each asset.</p>
          <a href="/employees" className="btn-primary mt-5">Open employee directory <ArrowUpRight size={16} /></a>
        </div>
        <div className="card border-l-4 border-l-attention p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">Signal</p>
          <p className="mt-3 text-3xl font-semibold text-navy-950">{activeStaff ?? 0}<span className="ml-2 text-sm font-medium text-ink-400">active staff</span></p>
          <p className="mt-2 text-sm leading-6 text-ink-600">Use this view as the first stop for onboarding, offboarding, and asset return follow-up.</p>
        </div>
      </div>
    </AppShell>
  );
}
