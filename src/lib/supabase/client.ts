import { createBrowserClient } from "@supabase/ssr";

// Thin wrapper on purpose — see server.ts for why. If the project ever
// moves off Supabase Auth (AWS Cognito, per the project's AWS-migration
// requirement) this file and server.ts are the only two places that
// change; nothing importing from here needs to know.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
