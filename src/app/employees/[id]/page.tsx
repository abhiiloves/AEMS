import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!employee) notFound();

  const { data: assignments } = await supabase
    .from("asset_assignment_history")
    .select("id, assigned_on, returned_on, assets:asset_id ( id, asset_code, brand, model )")
    .eq("employee_id", id)
    .order("assigned_on", { ascending: false });

  const current = (assignments ?? []).filter((a) => a.returned_on === null);
  const past = (assignments ?? []).filter((a) => a.returned_on !== null);

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <div className="mx-auto max-w-2xl">
        <p className="text-xs text-ink-400">{employee.employee_code}</p>
        <h1 className="mb-1 text-xl font-semibold text-ink-900">{employee.full_name}</h1>
        <p className="mb-6 text-sm text-ink-600">{employee.corporate_email}</p>

        <div className="card mb-4 p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Currently assigned ({current.length})</h2>
          {current.length === 0 ? (
            <p className="text-sm text-ink-400">No assets currently assigned.</p>
          ) : (
            <ul className="space-y-2">
              {current.map((a) => (
                <li key={a.id}>
                  <Link href={`/assets/${a.assets?.[0]?.id}`} className="text-sm text-accent hover:underline">
                    {a.assets?.[0]?.asset_code} — {a.assets?.[0]?.brand} {a.assets?.[0]?.model}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Assignment history ({assignments?.length ?? 0} total ever assigned)
          </h2>
          {past.length === 0 ? (
            <p className="text-sm text-ink-400">No past assignments.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {past.map((a) => (
                <li key={a.id} className="flex justify-between text-ink-600">
                  <span>
                    {a.assets?.[0]?.asset_code} — {a.assets?.[0]?.brand} {a.assets?.[0]?.model}
                  </span>
                  <span className="text-ink-400">
                    {new Date(a.assigned_on).toLocaleDateString()} → {a.returned_on ? new Date(a.returned_on).toLocaleDateString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
