import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAppContextFromHost, resolveTenantByHost, getBaseUrlForContext, AppContext, parseSubdomain, isReservedSubdomain, getHostType, getTenantSubdomain } from "@/lib/domains";
import { logDomainDebug, logTenantResolution } from "@/lib/middleware-debug";
import { getMarketingUrl, URLS } from "@/lib/urls";

const RESERVED = ["www", "pro", "admin"];

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const host = req.nextUrl.host;
  const pathname = req.nextUrl.pathname;

  // Log de depuración para sesión en proxy
  if (pathname.startsWith("/panel") || pathname.startsWith("/admin")) {
    // Log de cookies disponibles
    const authCookies = Array.from(req.cookies.getAll()).filter(c => 
      c.name.includes('sb-panel-auth')
    );
    
    // Log también todas las cookies para debugging
    const allCookies = Array.from(req.cookies.getAll());
    const cookieNames = allCookies.map(c => c.name);
    
    logDomainDebug(`[Proxy] Session check for ${pathname}:`, {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      authCookiesCount: authCookies.length,
      authCookieNames: authCookies.map(c => c.name),
      allCookiesCount: allCookies.length,
      allCookieNames: cookieNames,
    });
  }
  // ...existing code...
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|login/verify-code|public|_vercel|static|assets|img|fonts|docs|legal|robots.txt|sitemap.xml).*)",
  ],
};
