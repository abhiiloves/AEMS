import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { AssetWizard } from "@/components/AssetWizard";
import { redirect } from "next/navigation";

export default async function NewAssetPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();

  const [{ data: categories }, { data: departments }, { data: locations }, { data: plants }] = await Promise.all([
    supabase.from("asset_categories").select("id, name, code_prefix").eq("is_functional_module", false).order("name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("plants").select("id, name, location_id").order("name"),
  ]);

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <AssetWizard
        categories={categories ?? []}
        departments={departments ?? []}
        locations={locations ?? []}
        plants={plants ?? []}
      />
    </AppShell>
  );
}
