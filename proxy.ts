import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * PROXY BOOKFAST — Next.js 16
 * Maneja autenticación SSR + cookie personalizada sb-panel-auth
 */
export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Cliente Supabase SSR compatible con cookie personalizada
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Array.from(req.cookies.getAll()).map((c) => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, {
              ...options,
            });
          });
        },
      },
      cookieOptions: {
        name: "sb-panel-auth",
        path: "/",
        // NO domain (auto en prod, none en localhost)
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // DEBUG SOLO PANEL / ADMIN
  if (pathname.startsWith("/panel") || pathname.startsWith("/admin")) {
    const rawCookies = Array.from(req.cookies.getAll());
    const authCookies = rawCookies.filter((c) =>
      c.name.startsWith("sb-panel-auth")
    );

    console.log("[Proxy] Session check:", {
      path: pathname,
      hasSession: !!session,
      userId: session?.user?.id,
      authCookies: authCookies.map((c) => c.name),
      allCookies: rawCookies.map((c) => c.name),
    });
  }

  // PROTEGER PANEL
  if (!session && pathname.startsWith("/panel")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/panel/:path*"],
};
