import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAppContextFromHost, resolveTenantByHost, getBaseUrlForContext, AppContext, parseSubdomain, isReservedSubdomain, getHostType, getTenantSubdomain } from "@/lib/domains";
import { logDomainDebug, logTenantResolution } from "@/lib/middleware-debug";
import { getMarketingUrl, URLS } from "@/lib/urls";

const RESERVED = ["www", "pro", "admin"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const host = req.nextUrl.host;
  const pathname = req.nextUrl.pathname;
  const url = req.nextUrl.clone();

  // ============================================================================
  // NORMALIZACIÓN DE HOST Y PROTOCOLO (SOLO EN PRODUCCIÓN)
  // ============================================================================
  
  if (process.env.NODE_ENV === "production") {
    // 1. Redirigir http:// a https:// (301 permanente)
    if (req.nextUrl.protocol === "http:") {
      url.protocol = "https:";
      logDomainDebug(`Redirigiendo HTTP a HTTPS: ${url.toString()}`);
      return NextResponse.redirect(url, { status: 301 });
    }

    // 2. Redirigir www.bookfast.es a bookfast.es (301 permanente)
    if (host === "www.bookfast.es") {
      url.host = "bookfast.es";
      logDomainDebug(`Redirigiendo www a dominio raíz: ${url.toString()}`);
      return NextResponse.redirect(url, { status: 301 });
    }

    // 3. Redirigir rutas fuera de contexto en bookfast.es
    // Si alguien intenta acceder a /panel o /admin desde bookfast.es, redirigir al dominio correcto
    if (host === "bookfast.es") {
      if (pathname.startsWith("/panel")) {
        const { getProUrl } = await import("@/lib/urls");
        const proUrl = new URL(pathname, getProUrl());
        proUrl.search = req.nextUrl.search;
        logDomainDebug(`Redirigiendo /panel desde bookfast.es a pro.bookfast.es`);
        return NextResponse.redirect(proUrl, { status: 301 });
      }
      if (pathname.startsWith("/admin")) {
        const { getAdminUrl } = await import("@/lib/urls");
        const adminUrl = new URL(pathname, getAdminUrl());
        adminUrl.search = req.nextUrl.search;
        logDomainDebug(`Redirigiendo /admin desde bookfast.es a admin.bookfast.es`);
        return NextResponse.redirect(adminUrl, { status: 301 });
      }
    }
  }

  // Extraer subdominio para routing simplificado
  const [subdomain] = host.split(".");

  // ============================================================================
  // PROTECCIÓN DE APIs POR DOMINIO (aplicar antes de lógica por contexto)
  // ============================================================================

  // Permitir todas las rutas de API pasar sin procesamiento adicional
  // (excepto las que requieren verificación de dominio específico)
  if (pathname.startsWith("/api/")) {
    const appContext = getAppContextFromHost(host);
    
    // Bloquear APIs internas desde dominios que no corresponden
    if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/internal")) {
      if (appContext !== "pro" && appContext !== "admin") {
        logDomainDebug(`Intento de acceso a API interna desde contexto no permitido: ${appContext} (${host})`);
        return NextResponse.json(
          { error: "Esta API no está disponible desde este dominio" },
          { status: 403 }
        );
      }
    }
    
    // Permitir que todas las demás rutas de API pasen sin procesamiento
    return NextResponse.next();
  }

  const appContext = getAppContextFromHost(host);

  // Log de depuración (solo en desarrollo)
  logDomainDebug(`Request recibida`, {
    host,
    pathname,
    context: appContext,
    subdomain,
  });

  // ============================================================================
  // ROUTING POR DOMINIO CON REWRITES
  // ============================================================================

  // 1. bookfast.es y www.bookfast.es → público (marketing)
  if (host === "bookfast.es" || subdomain === "www") {
    return NextResponse.next();
  }

  // 2. Panel profesional (pro.bookfast.es)
  if (subdomain === "pro" || (host.includes("localhost") && pathname.startsWith("/panel"))) {
    // AISLAMIENTO: Bloquear /admin y redirigir a admin.bookfast.es (antes de rewrites)
    if (pathname.startsWith("/admin")) {
      const adminUrl = new URL(pathname, URLS.ADMIN_BASE);
      adminUrl.search = req.nextUrl.search;
      return NextResponse.redirect(adminUrl, { status: 301 });
    }

    // AISLAMIENTO: Bloquear /r/* y redirigir a marketing (antes de rewrites)
    if (pathname.startsWith("/r/")) {
      const marketingUrl = new URL("/", URLS.ROOT);
      return NextResponse.redirect(marketingUrl, { status: 301 });
    }

    // Si viene de Supabase magic link (con type=magiclink y token), redirigir al callback
    if (pathname === "/") {
      const type = url.searchParams.get("type");
      const token = url.searchParams.get("token");
      const code = url.searchParams.get("code");
      
      if ((type === "magiclink" && token) || code) {
        const callbackUrl = new URL("/auth/callback", url);
        url.searchParams.forEach((value, key) => {
          callbackUrl.searchParams.set(key, value);
        });
        logDomainDebug(`Magic link detectado en raíz, redirigiendo a callback`);
        return NextResponse.redirect(callbackUrl);
      }
      
      // Proteger antes de rewrite: si no hay sesión, redirigir a login
      if (!session) {
        url.pathname = "/login";
        url.searchParams.set("redirect", "/panel");
        return NextResponse.redirect(url);
      }
      
      // Rewrite / a /panel
      url.pathname = "/panel";
      logDomainDebug(`Rewriting / to /panel for pro domain`);
      return NextResponse.rewrite(url);
    }

    // Determinar la ruta final después del rewrite
    const finalPath = pathname.startsWith("/panel") ? pathname : `/panel${pathname}`;

    // Proteger rutas /panel/* (requiere sesión) - verificar ANTES del rewrite
    if (finalPath.startsWith("/panel") && !pathname.startsWith("/login") && !pathname.startsWith("/auth") && !session) {
      url.pathname = "/login";
      url.searchParams.set("redirect", finalPath);
      logDomainDebug(`No session found, redirecting to login with redirect=${finalPath}`);
      return NextResponse.redirect(url);
    }

    // Rewrite todas las rutas a /panel/* (excepto /auth, /api, /login, etc.)
    if (!pathname.startsWith("/panel") && 
        !pathname.startsWith("/auth") && 
        !pathname.startsWith("/api") &&
        !pathname.startsWith("/login") &&
        !pathname.startsWith("/logout") &&
        !pathname.startsWith("/_next")) {
      url.pathname = `/panel${pathname}`;
      logDomainDebug(`Rewriting ${pathname} to /panel${pathname} for pro domain`);
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // 3. Panel administrador (admin.bookfast.es)
  if (subdomain === "admin" || (host.includes("localhost") && pathname.startsWith("/admin"))) {
    // AISLAMIENTO: Bloquear /panel y redirigir a pro.bookfast.es (antes de rewrites)
    if (pathname.startsWith("/panel")) {
      const proUrl = new URL(pathname, URLS.PRO_BASE);
      proUrl.search = req.nextUrl.search;
      return NextResponse.redirect(proUrl, { status: 301 });
    }

    // AISLAMIENTO: Bloquear /r/* y redirigir a marketing (antes de rewrites)
    if (pathname.startsWith("/r/")) {
      const marketingUrl = new URL("/", URLS.ROOT);
      return NextResponse.redirect(marketingUrl, { status: 301 });
    }

    // Determinar la ruta final después del rewrite
    const finalPath = pathname.startsWith("/admin") ? pathname : `/admin${pathname}`;

    // Proteger rutas /admin/* (requiere sesión + Platform Admin) - verificar ANTES del rewrite
    if (finalPath.startsWith("/admin") && !pathname.startsWith("/login") && !pathname.startsWith("/auth")) {
      if (!session) {
        url.pathname = "/login";
        url.searchParams.set("redirect", finalPath);
        logDomainDebug(`No session found for admin, redirecting to login`);
        return NextResponse.redirect(url);
      }

      // Verificar si es platform admin
      const serviceRoleSupabase = getSupabaseServer();
      const { data: isAdmin, error } = await serviceRoleSupabase
        .rpc("check_platform_admin", { p_user_id: session.user.id })
        .single();

      if (error || !isAdmin) {
        url.pathname = "/login";
        url.searchParams.set("error", "unauthorized");
        logDomainDebug(`User is not platform admin, redirecting to login`);
        return NextResponse.redirect(url);
      }
    }

    // Rewrite / a /admin
    if (pathname === "/") {
      url.pathname = "/admin";
      logDomainDebug(`Rewriting / to /admin for admin domain`);
      return NextResponse.rewrite(url);
    }

    // Rewrite todas las rutas a /admin/* (excepto /auth, /api, /login, etc.)
    if (!pathname.startsWith("/admin") && 
        !pathname.startsWith("/auth") && 
        !pathname.startsWith("/api") &&
        !pathname.startsWith("/login") &&
        !pathname.startsWith("/logout") &&
        !pathname.startsWith("/_next")) {
      url.pathname = `/admin${pathname}`;
      logDomainDebug(`Rewriting ${pathname} to /admin${pathname} for admin domain`);
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // 4. Tenants dinámicos ({tenant}.bookfast.es)
  if (appContext === "tenantPublic") {
    const tenantSubdomain = getTenantSubdomain(host);
    
    // Verificar si el subdominio está reservado
    if (tenantSubdomain && isReservedSubdomain(tenantSubdomain)) {
      logDomainDebug(`Subdominio reservado detectado: ${tenantSubdomain}, redirigiendo a marketing`);
      const marketingUrl = new URL("/", getMarketingUrl());
      return NextResponse.redirect(marketingUrl);
    }

    // Resolver tenant desde el host (ahora también busca por public_subdomain)
    const tenant = await resolveTenantByHost(host);
    logTenantResolution(host, tenant, tenant !== null && tenant.id !== null && tenant.id !== "");

    // Si no se puede resolver el tenant o no tiene ID válido, manejar de forma segura
    if (!tenant || !tenant.id || tenant.id.trim() === "") {
      if (host.includes("localhost") || host.includes("127.0.0.1")) {
        logDomainDebug(`Tenant no resuelto en desarrollo, permitiendo acceso directo a /r/[orgId]`);
        // No hacer nada, dejar que la ruta /r/[orgId] maneje esto con notFound()
      } else {
        logDomainDebug(`Tenant no encontrado o sin ID válido para ${host}, redirigiendo a marketing`);
        const marketingUrl = new URL("/", getMarketingUrl());
        marketingUrl.searchParams.set("reason", "unknown-tenant");
        return NextResponse.redirect(marketingUrl);
      }
    } else {
      // Rewrite / a /r/[id] para mostrar el portal de reservas
      // SIEMPRE usar tenant.id (UUID) como fuente de verdad, nunca slug
      if (pathname === "/") {
        url.pathname = `/r/${tenant.id}`;
        logDomainDebug(`Rewriting / to /r/${tenant.id.substring(0, 8)}... for tenant domain`);
        return NextResponse.rewrite(url);
      }

      // Si la ruta ya es /r/[algo], verificar que sea el tenant correcto
      if (pathname.startsWith("/r/")) {
        const orgIdFromPath = pathname.split("/")[2];
        // Si el orgId en la ruta no coincide con el tenant resuelto, hacer rewrite
        if (orgIdFromPath !== tenant.id && orgIdFromPath !== tenant.slug) {
          url.pathname = `/r/${tenant.id}`;
          logDomainDebug(`Rewriting /r/${orgIdFromPath} to /r/${tenant.id.substring(0, 8)}... for tenant domain`);
          return NextResponse.rewrite(url);
        }
      }
    }

    // AISLAMIENTO: Bloquear /panel y redirigir a pro.bookfast.es
    if (pathname.startsWith("/panel")) {
      const proUrl = new URL(pathname, URLS.PRO_BASE);
      proUrl.search = req.nextUrl.search;
      return NextResponse.redirect(proUrl, { status: 301 });
    }

    // AISLAMIENTO: Bloquear /admin y redirigir a admin.bookfast.es
    if (pathname.startsWith("/admin")) {
      const adminUrl = new URL(pathname, URLS.ADMIN_BASE);
      adminUrl.search = req.nextUrl.search;
      return NextResponse.redirect(adminUrl, { status: 301 });
    }
  }

  // ============================================================================
  // PROTECCIÓN LEGACY (para desarrollo en localhost)
  // ============================================================================

  // En desarrollo (localhost), aplicar protección normal sin redirecciones de dominio
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    const isPanel = pathname.startsWith("/panel");
    const isAdmin = pathname.startsWith("/admin");

    // Proteger /panel (requiere sesión)
    if (isPanel && !session) {
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Proteger /admin (requiere sesión + platform admin)
    if (isAdmin) {
      if (!session) {
        url.pathname = "/login";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }

      // Verificar si es platform admin
      const serviceRoleSupabase = getSupabaseServer();
      const { data: isAdmin, error } = await serviceRoleSupabase
        .rpc("check_platform_admin", { p_user_id: session.user.id })
        .single();

      if (error || !isAdmin) {
        url.pathname = "/login";
        url.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/health (health check endpoint)
     * - api/webhooks/stripe (Stripe webhooks)
     * - api/internal/cron/* (internal cron jobs)
     * - auth/callback (Supabase auth callback)
     * - auth/magic-link-handler (client-side magic link handler)
     * - /public (public assets)
     * - /_vercel (Vercel internal routes)
     * - /static (static assets)
     * - /assets (assets folder)
     * - /img (images folder)
     * - /fonts (fonts folder)
     * - /docs (documentation folder)
     * - /legal (legal pages)
     * - /robots.txt
     * - /sitemap.xml
     */
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/webhooks/stripe|api/internal/cron|auth/callback|auth/magic-link-handler|public|_vercel|static|assets|img|fonts|docs|legal|robots.txt|sitemap.xml).*)",
  ],
};
