import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getHostType, parseSubdomain } from "@/lib/domains";

export async function proxy(request: NextRequest) {
    // 0. STRICT ISOLATION PHASE
    // No global bypass for "/login": on tenant domains, "/login" is a public
    // route that must rewrite to the tenant portal. Auth-loop prevention is
    // handled per-domain below.
    const url = request.nextUrl;
    const path = url.pathname;

    // 1. Initialize Response
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    // 2. Refresh Session (Supabase SSR)
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
            cookieOptions: {
                name: "sb-panel-auth",
                maxAge: 31536000,
            },
        }
    );

    // IMPORTANT: Do not run getUser() if not needed to avoid extra auth calls on public assets
    // But for security guards we usually need it.
    // We will call it only if we need to check auth state for specific routes.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 3. Subdomain Resolution
    const host = request.headers.get("host") || "";
    const hostType = getHostType(host);
    const subdomain = parseSubdomain(host);

    // ----------------------------------------------------------------------
    // TRAFFIC POLICE : ROUTING RULES (Based on MIDDLEWARE_PRODUCCION_FINAL.md)
    // ----------------------------------------------------------------------

    // A. PRO DOMAIN (pro.bookfast.es) -> Panel de Profesionales
    if (hostType === "pro") {
        // PROTECCIÓN: Bloquear acceso a rutas de Admin
        if (path.startsWith("/admin")) {
            return NextResponse.redirect(new URL(`https://admin.bookfast.es${path}`));
        }
        // PROTECCIÓN: Bloquear acceso a rutas de Tenant Portal
        if (path.startsWith("/r/")) {
            return NextResponse.redirect(new URL("https://bookfast.es"));
        }

        // EXCLUSION: No tocar root, login ni auth.
        if (path === "/" || path.startsWith("/login") || path.startsWith("/auth")) {
            return response;
        }

        // GUARD: Proteger /panel (Auth Required)
        if (path.startsWith("/panel")) {
            if (!user) {
                const loginUrl = new URL("/login", request.url);
                loginUrl.searchParams.set("redirect", path);
                return NextResponse.redirect(loginUrl);
            }
        }

        // Allow normal routing for everything else
        return response;
    }

    // B. ADMIN DOMAIN (admin.bookfast.es) -> Panel de Plataforma
    if (hostType === "admin") {
        // PROTECCIÓN: Bloquear acceso a rutas de Panel Pro
        if (path.startsWith("/panel")) {
            return NextResponse.redirect(new URL(`https://pro.bookfast.es${path}`));
        }

        // REWRITE: Mapear rutas limpias
        if (path === "/") {
            return NextResponse.rewrite(new URL("/admin", request.url));
        }

        // Si no empieza por /admin, ni login/api, reescribir a /admin/...
        if (
            !path.startsWith("/admin") &&
            !path.startsWith("/login") &&
            !path.startsWith("/api") &&
            !path.startsWith("/_next") &&
            !path.startsWith("/static")
        ) {
            return NextResponse.rewrite(new URL(`/admin${path}`, request.url));
        }

        // GUARD: Proteger /admin (Auth Required - RBAC inside page)
        if (path.startsWith("/admin")) {
            if (!user) {
                const loginUrl = new URL("https://pro.bookfast.es/login");
                loginUrl.searchParams.set("redirect", request.url);
                return NextResponse.redirect(loginUrl);
            }
        }

        return response;
    }

    // C. TENANT DOMAIN ({tenant}.bookfast.es) -> Portal Público
    // Ej: barberia.bookfast.es → sirve /r/[subdomain][path]
    if (hostType === "tenant" && subdomain) {
        // PROTECCIÓN: Bloquear panel y admin
        if (path.startsWith("/panel")) {
            return NextResponse.redirect(new URL("https://pro.bookfast.es/panel"));
        }
        if (path.startsWith("/admin")) {
            return NextResponse.redirect(new URL("https://admin.bookfast.es"));
        }

        // Pasar sin reescribir API, assets
        if (
            path.startsWith("/api/") ||
            path.startsWith("/_next/") ||
            path.startsWith("/static/")
        ) {
            return response;
        }

        // REWRITE (nuevo portal): Cualquier ruta pública → /t/[tenantId][path]
        // Mantiene URLs externas limpias:
        //   www.barberia.bookfast.es/servicios -> /t/barberia/servicios
        const internalPath = path === "/" ? `/t/${subdomain}` : `/t/${subdomain}${path}`;
        return NextResponse.rewrite(new URL(internalPath, request.url));
    }

    // D. MARKETING / WWW (Default)
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
