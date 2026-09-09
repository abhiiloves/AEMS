import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { UserManagementBoard } from "@/components/UserManagementBoard";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  const [{ data: categories }, { data: locations }, { data: plants }, { data: departments }, { data: subDepartments }] = await Promise.all([
    supabase.from("asset_categories").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("plants").select("id, name, location_id"),
    supabase.from("departments").select("id, name, plant_id"),
    supabase.from("sub_departments").select("id, name, department_id"),
  ]);

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <UserManagementBoard
        currentUserRole={appUser?.role ?? "user"}
        categories={categories ?? []}
        locations={locations ?? []}
        plants={plants ?? []}
        departments={departments ?? []}
        subDepartments={subDepartments ?? []}
      />
    </AppShell>
  );
}
