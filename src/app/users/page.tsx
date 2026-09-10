import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { UserManagementBoard } from "@/components/UserManagementBoard";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  const [{ data: categories }, { data: locations }, { data: plants }] = await Promise.all([
    supabase.from("asset_categories").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("plants").select("id, name"),
  ]);

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <UserManagementBoard
        currentUserRole={appUser?.role ?? "user"}
        categories={categories ?? []}
        locations={locations ?? []}
        plants={plants ?? []}
      />
    </AppShell>
  );
}
