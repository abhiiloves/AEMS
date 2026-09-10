import { createServerSupabase } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { AssetsBrowser } from "@/components/AssetsBrowser";
import { redirect } from "next/navigation";

export default async function AssetsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: appUser } = await supabase.from("users").select("email, role").eq("auth_id", user.id).single();
  const { data: categories } = await supabase.from("asset_categories").select("id, name").eq("is_functional_module", false).order("name");

  return (
    <AppShell userEmail={appUser?.email ?? user.email ?? ""} userRole={appUser?.role ?? "user"}>
      <AssetsBrowser categories={categories ?? []} />
    </AppShell>
  );
}
