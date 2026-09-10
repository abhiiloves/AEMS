import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { AuditLogTable } from "@/components/AuditLogTable";
import { redirect } from "next/navigation";

export default async function AuditLogsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <AuditLogTable canExport={appUser?.role === "admin" || appUser?.role === "it_admin"} isItAdmin={appUser?.role === "it_admin"} />
    </AppShell>
  );
}
