import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) return res;

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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return res;

  const { data: appSession } = await supabase
    .from("sessions")
    .select("id, is_active, last_activity, role")
    .eq("session_token", sessionId)
    .maybeSingle();

  if (!appSession || !appSession.is_active) {
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
