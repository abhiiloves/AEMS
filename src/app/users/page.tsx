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

<<<<<<< HEAD
  const [{ data: categories }, { data: locations }, { data: plants }] = await Promise.all([
    supabase.from("asset_categories").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("plants").select("id, name"),
=======
  const [{ data: categories }, { data: locations }, { data: plants }, { data: departments }, { data: subDepartments }] = await Promise.all([
    supabase.from("asset_categories").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("plants").select("id, name, location_id"),
    supabase.from("departments").select("id, name, plant_id"),
    supabase.from("sub_departments").select("id, name, department_id"),
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
  ]);

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <UserManagementBoard
        currentUserRole={appUser?.role ?? "user"}
        categories={categories ?? []}
        locations={locations ?? []}
        plants={plants ?? []}
<<<<<<< HEAD
=======
        departments={departments ?? []}
        subDepartments={subDepartments ?? []}
>>>>>>> 83485868e5f6aece6e75b073db6bda2739bcc592
      />
    </AppShell>
  );
}
