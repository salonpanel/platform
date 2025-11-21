/**
 * Handler de callback para autenticación con Magic Links de Supabase
 * 
 * Este endpoint maneja la redirección después de que el usuario hace clic en el magic link
 * enviado por email.
 * 
 * FLUJO ESPERADO:
 * 1. El usuario recibe un email con un magic link de Supabase
 * 2. El link apunta a /auth/callback?code=...&redirect_to=/panel
 * 3. Este handler intercambia el código por una sesión usando exchangeCodeForSession
 * 4. exchangeCodeForSession setea automáticamente las cookies de Supabase
 * 5. Redirige al usuario a la ruta indicada en redirect_to
 * 
 * IMPORTANTE: Este es el único punto donde se setean las cookies de sesión.
 * El cliente NO debe manejar tokens directamente del hash.
 */
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "@/lib/supabase";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestHeaders = await headers();

  // Log inicial para debug
  console.log("[AuthCallback] Request received:", {
    host: url.host,
    pathname: url.pathname,
    searchParams: Array.from(url.searchParams.keys()),
    hasCode: !!url.searchParams.get("code"),
    hasAccessToken: !!url.searchParams.get("access_token"),
    hasRefreshToken: !!url.searchParams.get("refresh_token"),
  });

  // Configurar allowedAppUrl
  let allowedAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!allowedAppUrl) {
    const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    if (isDevelopment) {
      allowedAppUrl = `${url.protocol}//${url.host}`;
      console.log("[AuthCallback] Using development host:", allowedAppUrl);
    } else {
      console.error("[AuthCallback] NEXT_PUBLIC_APP_URL not configured in production");
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL no configurado. Configura esta variable en producción." },
        { status: 500 }
      );
    }
  }

  const allowedHost = new URL(allowedAppUrl).host;
  const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

  // Validación de host (solo en producción)
  if (!isDevelopment) {
    if (url.host !== allowedHost) {
      console.error("[AuthCallback] Host mismatch:", { requestHost: url.host, allowedHost });
      return NextResponse.json(
        { error: "Host de callback inválido." },
        { status: 400 }
      );
    }
  }

  // Buscar código o tokens en query params
  const code = url.searchParams.get("code");
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");

  // Buscar redirect_to (parámetro estándar de Supabase) o redirect (fallback)
  const redirectParam = url.searchParams.get("redirect_to") || url.searchParams.get("redirect");

  // SEGURIDAD: Validar redirect con whitelist de rutas permitidas
  // Esto previene open redirect attacks
  const allowedPaths = [
    '/panel',
    '/panel/agenda',
    '/panel/clientes',
    '/panel/servicios',
    '/panel/staff',
    '/panel/configuracion',
    '/admin',
    '/admin/tenants',
    '/admin/usuarios',
  ];

  let redirectTo = "/panel"; // Default seguro

  if (redirectParam) {
    // Validar que sea una ruta interna (empieza con / pero no con //)
    const isInternal = redirectParam.startsWith('/') && !redirectParam.startsWith('//');
    // Validar que esté en la whitelist
    const isAllowed = allowedPaths.some(path => redirectParam.startsWith(path));

    if (isInternal && isAllowed) {
      redirectTo = redirectParam;
      if (isDevelopment) {
        console.log("[AuthCallback] Redirect permitido:", redirectTo);
      }
    } else {
      console.warn("[AuthCallback] Redirect no permitido, usando default:", {
        requested: redirectParam,
        isInternal,
        isAllowed,
        default: redirectTo,
      });
    }
  }


  // Si no hay código ni tokens, error
  if (!code && !accessToken) {
    console.error("[AuthCallback] No code or access_token provided");
    return NextResponse.json(
      {
        error: "Código de autenticación no proporcionado. Asegúrate de que el magic link apunta a /auth/callback.",
        hint: "Verifica que emailRedirectTo en signInWithOtp apunta a /auth/callback"
      },
      { status: 400 }
    );
  }

  try {
    console.log("[AuthCallback] Creating Supabase client...");
    // Crear cliente de Supabase con cookies (Next.js 16+)
    // En Next.js 16, cookies() NO es async en route handlers, se pasa directamente
    const supabaseClient = createRouteHandlerClient({ cookies });
    console.log("[AuthCallback] Supabase client created");

    let session;

    // Caso 1: Intercambiar código por sesión (flujo estándar de magic link)
    if (code) {
      console.log("[AuthCallback] Exchanging code for session...");
      const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AuthCallback] Error exchanging code for session:", error);

        if (
          error.message?.includes("code verifier") ||
          error.message?.includes("code_verifier") ||
          error.message?.includes("expired") ||
          error.message?.includes("invalid")
        ) {
          return NextResponse.json(
            {
              error: "El enlace ha expirado o es inválido. Por favor, solicita un nuevo enlace mágico desde la página de login."
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { error: error.message ?? "No se pudo iniciar sesión." },
          { status: 400 }
        );
      }

      session = data.session;
      console.log("[AuthCallback] Session established via code exchange:", { userId: session?.user?.id });
    }
    // Caso 2: Establecer sesión directamente con tokens (flujo alternativo)
    else if (accessToken && refreshToken) {
      console.log("[AuthCallback] Setting session with tokens...", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length,
        refreshTokenLength: refreshToken?.length,
      });

      const { data, error } = await supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("[AuthCallback] Error setting session:", error, {
          errorMessage: error.message,
          errorName: error.name,
        });
        return NextResponse.json(
          { error: error.message ?? "No se pudo establecer la sesión." },
          { status: 400 }
        );
      }

      session = data.session;
      console.log("[AuthCallback] Session established via tokens:", {
        userId: session?.user?.id,
        hasSession: !!session,
      });
    }

    if (!session) {
      console.error("[AuthCallback] No session after authentication");
      return NextResponse.json(
        { error: "No se pudo establecer la sesión. Por favor, intenta de nuevo." },
        { status: 400 }
      );
    }

    // Intentar registrar en auth_logs (opcional, no debe romper el flujo si falla)
    if (session.user?.id) {
      try {
        const sb = supabaseServer();
        const clientIp = getClientIp(requestHeaders);
        const userAgent = requestHeaders.get("user-agent") ?? undefined;

        await sb.from("auth_logs").insert({
          user_id: session.user.id,
          event: "login",
          ip: clientIp,
          user_agent: userAgent,
        });
      } catch (logError) {
        console.warn("[AuthCallback] Error logging to auth_logs (non-critical):", logError);
      }
    }

    // Redirigir al panel (o a la ruta indicada)
    const finalRedirectUrl = new URL(redirectTo, allowedAppUrl);
    console.log("[AuthCallback] Redirecting to:", finalRedirectUrl.toString());

    return NextResponse.redirect(finalRedirectUrl);
  } catch (err: any) {
    console.error("[AuthCallback] Unexpected error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado al procesar la autenticación." },
      { status: 500 }
    );
  }
}
