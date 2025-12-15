import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getHostType, parseSubdomain } from "@/lib/domains";

export async function middleware(request: NextRequest) {
    // 0. STRICT ISOLATION PHASE
    // Absolute bypass for root and login.
    // REMOVED /panel from bypass to restore protection.
    const url = request.nextUrl;
    const path = url.pathname;

    if (path === "/" || path.startsWith("/login")) {
        return NextResponse.next();
    }


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
    // 3. Subdomain Resolution
    const host = request.headers.get("host") || "";
    const hostType = getHostType(host);
    const subdomain = parseSubdomain(host);
    // url and path already declared at top
    // const url = request.nextUrl;
    // const path = url.pathname;

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

        // REWRITE: Mapear rutas limpias a la estructura real /panel
        // Si la ruta es raiz, ir al dashboard
        // EXCLUSION SOLICITADA: No tocar root, login.
        if (path === "/" || path.startsWith("/login") || path.startsWith("/auth")) {
            return response;
        }

        /*
        // REWRITE: Mapear rutas limpias a la estructura real /panel
        // Si la ruta es raiz, ir al dashboard
        if (path === "/") {
            return NextResponse.rewrite(new URL("/panel", request.url));
        }

        // Si la ruta NO empieza por /panel, /login, /api, /_next, etc...
        // asuminos que es una ruta de panel limpia (ej: /agenda) y hacemos rewrite
        if (
            !path.startsWith("/panel") &&
            !path.startsWith("/login") &&
            !path.startsWith("/auth") &&
            !path.startsWith("/api") &&
            !path.startsWith("/_next") &&
            !path.startsWith("/static") &&
            !path.startsWith("/favicon.ico")
        ) {
            return NextResponse.rewrite(new URL(`/panel${path}`, request.url));
        }
        */

        // GUARD: Proteger /panel (Auth Required)
        // ENABLED FOR PHASE 1
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
                // Admin could have separate login, but we redirect to global login for now
                const loginUrl = new URL("https://pro.bookfast.es/login");
                loginUrl.searchParams.set("redirect", request.url); // Redirect back to admin
                return NextResponse.redirect(loginUrl);
            }
        }

        return response;
    }

    // C. TENANT DOMAIN ({tenant}.bookfast.es) -> Portal Público
    if (hostType === "tenant" && subdomain) {
        // PROTECCIÓN: Bloquear panel y admin
        if (path.startsWith("/panel")) {
            return NextResponse.redirect(new URL("https://pro.bookfast.es/panel"));
        }
        if (path.startsWith("/admin")) {
            return NextResponse.redirect(new URL("https://admin.bookfast.es"));
        }

        // Auth Guard not strictly needed for public portal, but if booking requires it, page handles it.

        // REWRITE: Root -> /r/[subdomain]
        if (path === "/") {
            return NextResponse.rewrite(new URL(`/r/${subdomain}`, request.url));
        }

        // Allow standard paths if needed, or enforce rewrite?
        // For now, allow other paths to pass through (e.g. /services, /booking) if they exist
        // But likely they are under /r/[slug]/... ?? 
        // Design says: "{tenant} -> rewrite a /r/[tenant-id]". 
        // We use subdomain (slug) here as we avoid DB fetch in middleware. 
        // /r/[slug] page must handle slug resolution.

        return response;
    }

    // D. MARKETING / WWW (Default)
    // No rewrites needed.
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc) - though this regex handles dot files
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
