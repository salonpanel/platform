import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAppContextFromHost, resolveTenantByHost, getBaseUrlForContext, AppContext, parseSubdomain, isReservedSubdomain, getHostType, getTenantSubdomain } from "@/lib/domains";
import { logDomainDebug, logTenantResolution } from "@/lib/middleware-debug";
import { getMarketingUrl, URLS } from "@/lib/urls";

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

  const appContext = getAppContextFromHost(host);

  // Log de depuración (solo en desarrollo)
  logDomainDebug(`Request recibida`, {
    host,
    pathname,
    context: appContext,
  });

  // ============================================================================
  // PROTECCIÓN DE APIs POR DOMINIO (aplicar antes de lógica por contexto)
  // ============================================================================

  // Bloquear APIs internas desde dominios que no corresponden
  // /api/admin/* solo accesible desde admin.bookfast.es o pro.bookfast.es
  // /api/internal/* solo accesible desde admin.bookfast.es o pro.bookfast.es
  if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/internal")) {
    // Permitir solo desde contextos pro o admin
    if (appContext !== "pro" && appContext !== "admin") {
      logDomainDebug(`Intento de acceso a API interna desde contexto no permitido: ${appContext} (${host})`);
      return NextResponse.json(
        { error: "Esta API no está disponible desde este dominio" },
        { status: 403 }
      );
    }
  }

  // ============================================================================
  // LÓGICA POR CONTEXTO DE DOMINIO
  // ============================================================================

  // --- PRO (pro.bookfast.es) ---
  if (appContext === "pro") {
    // Si viene de Supabase magic link (con type=magiclink y token), redirigir al callback
    if (pathname === "/") {
      const type = url.searchParams.get("type");
      const token = url.searchParams.get("token");
      const code = url.searchParams.get("code");
      
      // Si viene de Supabase con magic link, redirigir al callback
      if ((type === "magiclink" && token) || code) {
        const callbackUrl = new URL("/auth/callback", url);
        // Preservar todos los query params
        url.searchParams.forEach((value, key) => {
          callbackUrl.searchParams.set(key, value);
        });
        logDomainDebug(`Magic link detectado en raíz, redirigiendo a callback`);
        return NextResponse.redirect(callbackUrl);
      }
      
      // Redirigir / a /panel (solo si no es un magic link)
      url.pathname = "/panel";
      return NextResponse.redirect(url);
    }

    // AISLAMIENTO: Bloquear /admin y redirigir a admin.bookfast.es
    if (pathname.startsWith("/admin")) {
      const adminUrl = new URL(pathname, URLS.ADMIN_BASE);
      adminUrl.search = req.nextUrl.search;
      return NextResponse.redirect(adminUrl);
    }

    // AISLAMIENTO: Bloquear /r/* y redirigir a marketing
    if (pathname.startsWith("/r/")) {
      const marketingUrl = new URL("/", URLS.ROOT);
      return NextResponse.redirect(marketingUrl);
    }

    // Proteger /panel/* (requiere sesión)
    if (pathname.startsWith("/panel") && !session) {
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // --- ADMIN (admin.bookfast.es) ---
  if (appContext === "admin") {
    // Redirigir / a /admin
    if (pathname === "/") {
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // AISLAMIENTO: Bloquear /panel y redirigir a pro.bookfast.es
    if (pathname.startsWith("/panel")) {
      const proUrl = new URL(pathname, URLS.PRO_BASE);
      proUrl.search = req.nextUrl.search;
      return NextResponse.redirect(proUrl);
    }

    // AISLAMIENTO: Bloquear /r/* y redirigir a marketing
    if (pathname.startsWith("/r/")) {
      const marketingUrl = new URL("/", URLS.ROOT);
      return NextResponse.redirect(marketingUrl);
    }

    // Proteger /admin/* (requiere sesión + Platform Admin)
    if (pathname.startsWith("/admin")) {
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

  // --- TENANT PUBLIC ({tenant}.bookfast.es) ---
  if (appContext === "tenantPublic") {
    const subdomain = parseSubdomain(host);
    
    // Verificar si el subdominio está reservado
    if (subdomain && isReservedSubdomain(subdomain)) {
      logDomainDebug(`Subdominio reservado detectado: ${subdomain}, redirigiendo a marketing`);
      const marketingUrl = new URL("/", getMarketingUrl());
      return NextResponse.redirect(marketingUrl);
    }

    // Resolver tenant desde el host
    const tenant = await resolveTenantByHost(host);
    logTenantResolution(host, tenant, tenant !== null && tenant.id !== null && tenant.id !== "");

    // Si no se puede resolver el tenant o no tiene ID válido, manejar de forma segura
    if (!tenant || !tenant.id || tenant.id.trim() === "") {
      // En desarrollo con localhost, permitir /r/[orgId] como fallback
      if (host.includes("localhost") || host.includes("127.0.0.1")) {
        logDomainDebug(`Tenant no resuelto en desarrollo, permitiendo acceso directo a /r/[orgId]`);
        // No hacer nada, dejar que la ruta /r/[orgId] maneje esto con notFound()
      } else {
        // En producción o localtest.me, redirigir al dominio raíz con query param
        // Opción elegida: redirigir a marketing con ?reason=unknown-tenant
        // La página /r/[orgId] también manejará el caso con notFound() si se accede directamente
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
        logDomainDebug(`Rewriting / to /r/${tenant.id.substring(0, 8)}...`);
        return NextResponse.rewrite(url);
      }
    }

    // AISLAMIENTO: Bloquear /panel y redirigir a pro.bookfast.es
    if (pathname.startsWith("/panel")) {
      const { URLS } = await import("@/lib/urls");
      const proUrl = new URL(pathname, URLS.PRO_BASE);
      proUrl.search = req.nextUrl.search;
      return NextResponse.redirect(proUrl);
    }

    // AISLAMIENTO: Bloquear /admin y redirigir a admin.bookfast.es
    if (pathname.startsWith("/admin")) {
      const { URLS } = await import("@/lib/urls");
      const adminUrl = new URL(pathname, URLS.ADMIN_BASE);
      adminUrl.search = req.nextUrl.search;
      return NextResponse.redirect(adminUrl);
    }
  }

  // --- MARKETING (bookfast.es) ---
  if (appContext === "marketing") {
    // Permitir /login, /legal/*, etc.
    // No bloquear nada específico aquí por ahora
    // En el futuro, aquí se puede añadir lógica para la web comercial
    logDomainDebug(`Marketing domain, permitiendo acceso`);
  }

  // --- UNKNOWN (caso no contemplado) ---
  if (appContext === "unknown") {
    // Si el host no coincide con ningún patrón conocido:
    // - pro.bookfast.es
    // - admin.bookfast.es
    // - *.bookfast.es (subdomain válido de tenant)
    // - bookfast.es
    // - localhost / 127.0.0.1
    // Entonces redirigir SIEMPRE de forma segura a marketing
    logDomainDebug(`Host desconocido/inválido detectado: ${host}, redirigiendo a marketing`);
    const marketingUrl = new URL("/", getMarketingUrl());
    return NextResponse.redirect(marketingUrl);
  }

  // ============================================================================
  // PROTECCIÓN LEGACY (para desarrollo en localhost)
  // ============================================================================

  // En desarrollo (localhost), aplicar protección normal sin redirecciones de dominio
  // Nota: El bloqueo de APIs ya se aplicó arriba, así que aquí solo protegemos rutas de página
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
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
