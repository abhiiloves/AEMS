import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

// Server-side client using the anon key + the caller's session cookie,
// so every query still goes through RLS as that user — this is what
// makes the RLS policies the real enforcement layer instead of the
// app trusting itself. Never use the service-role key in request-path
// code; it bypasses RLS entirely and is reserved for isolated,
// carefully-reviewed jobs (e.g. the QR-scan complaint intake, cron).
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => cookieStore.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) => cookieStore.set({ name, value: "", ...options }),
      },
    }
  );
}

// Service-role client — deliberately isolated in its own function so
// it's easy to grep for every place that bypasses RLS and audit them.
export function createServiceRoleSupabase() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
