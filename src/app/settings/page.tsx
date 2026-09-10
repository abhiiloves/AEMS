import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SettingsBoard } from "@/components/SettingsBoard";
import { redirect } from "next/navigation";

// Settings is IT-Admin-write-only at the RLS layer for every tab here
// (locations_write / plants_write / categories_write / form_fields_write
// / departments_write policies) â€” this page renders for anyone so
// Admin/HR/User can still read the lookups, but the add/edit controls
// in SettingsBoard check role client-side too, matching the pattern
// used everywhere else (server RLS is the real gate, client checks are UX).
export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <SettingsBoard isItAdmin={appUser?.role === "it_admin"} />
    </AppShell>
  );
}
