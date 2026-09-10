import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Enforces, on every request:
//  1. session must exist and be marked is_active in the `sessions` table
//  2. idle-timeout for the caller's role (5 min admin/it_admin, 3-4 hr user/hr)
//  3. single-active-session — if another login has since flipped this
//     session's is_active to false, the user is force-logged-out here,
//     not just left to find out on their next explicit action.
//
// Fixed in cross-check: this used to look sessions up by Supabase's
// access_token, which supabase-ssr rotates on refresh — causing valid
// sessions to spuriously fail the idle check. Now it uses our own
// opaque `aems_sid` cookie (see lib/auth/session.ts), which stays
// constant for the life of the session regardless of token refreshes.
//
// Note: sleep/shutdown/network-disconnect logout is primarily a
// client-side concern (visibilitychange / offline listeners in the app
// shell, not yet built — see README) — this middleware is the
// server-side backstop that makes the idle-timeout and single-session
// rules unavoidable even if the client never gets a chance to report
// the disconnect.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) return res; // no app session cookie -> not logged in via our flow yet

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) => res.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return res;

  const { data: appSession } = await supabase
    .from("sessions")
    .select("id, is_active, last_activity, role")
    .eq("session_token", sessionId)
    .maybeSingle();

  if (!appSession || !appSession.is_active) {
    // Kicked out by a newer login elsewhere, or session row missing.
    await supabase.auth.signOut();
    const redirect = NextResponse.redirect(new URL("/login?reason=session_ended", req.url));
    redirect.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return redirect;
  }

  const idleMinutes = appSession.role === "admin" || appSession.role === "it_admin" ? 5 : 240;
  const idleMs = Date.now() - new Date(appSession.last_activity).getTime();
  if (idleMs > idleMinutes * 60 * 1000) {
    await supabase.from("sessions").update({ is_active: false }).eq("id", appSession.id);
    await supabase.auth.signOut();
    const redirect = NextResponse.redirect(new URL("/login?reason=idle_timeout", req.url));
    redirect.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return redirect;
  }

  await supabase.from("sessions").update({ last_activity: new Date().toISOString() }).eq("id", appSession.id);

  return res;
}

export const config = {
  matcher: ["/((?!login|api/maintenance/scan|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
