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
  let allowedAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  // En desarrollo, usar el host de la request si NEXT_PUBLIC_APP_URL no está configurado
  if (!allowedAppUrl) {
    const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    if (isDevelopment) {
      allowedAppUrl = `${url.protocol}//${url.host}`;
    } else {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL no configurado. Configura esta variable en producción." },
        { status: 500 }
      );
    }
  }

  const allowedHost = new URL(allowedAppUrl).host;
  const requestHeaders = await headers();
  const originHeader = requestHeaders.get("origin");

  // En desarrollo, ser más flexible con la verificación de host
  const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  
  if (!isDevelopment) {
    // En producción, verificar estrictamente
    if (originHeader) {
      try {
        const originHost = new URL(originHeader).host;
        if (originHost !== allowedHost) {
          return NextResponse.json(
            { error: "Host de origen no permitido." },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Origen inválido." }, { status: 400 });
      }
    }

    if (url.host !== allowedHost) {
      return NextResponse.json(
        { error: "Host de callback inválido." },
        { status: 400 }
      );
    }
  }

  // Buscar código en query params (Supabase usa 'code' cuando emailRedirectTo apunta a /auth/callback)
  const code = url.searchParams.get("code");
  
  // Buscar redirect_to (parámetro estándar de Supabase) o redirect (fallback)
  const redirectTo = url.searchParams.get("redirect_to") || url.searchParams.get("redirect") || "/panel";

  // Si no hay código, el magic link no pasó por el callback correctamente
  if (!code) {
    return NextResponse.json(
      { 
        error: "Código de autenticación no proporcionado. Asegúrate de que el magic link apunta a /auth/callback.",
        hint: "Verifica que emailRedirectTo en signInWithOtp apunta a /auth/callback"
      },
      { status: 400 }
    );
  }

  try {
    // Crear cliente de Supabase con cookies (Next.js 16+)
    // IMPORTANTE: Pasar la función cookies directamente, no el resultado await
    const supabaseClient = createRouteHandlerClient({ cookies });
    
    // Intercambiar código por sesión - esto setea las cookies automáticamente
    // exchangeCodeForSession es el método oficial de Supabase para magic links
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Error al intercambiar código por sesión:", error);
      console.error("Detalles del error:", JSON.stringify(error, null, 2));
      
      // Si el error es de PKCE o token inválido, el código puede haber expirado
      if (
        error.message?.includes("code verifier") || 
        error.message?.includes("code_verifier") ||
        error.message?.includes("expired") ||
        error.message?.includes("invalid")
      ) {
        return NextResponse.json(
          { 
            error: "El enlace ha expirado o es inválido. Por favor, solicita un nuevo enlace mágico desde la página de login. Si el problema persiste, verifica que no hayas hecho clic en el enlace más de una vez." 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: error.message ?? "No se pudo iniciar sesión." },
        { status: 400 }
      );
    }

    const session = data.session;
    
    if (!session) {
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
        // No romper el flujo si el log falla
        console.warn("Error al registrar en auth_logs (no crítico):", logError);
      }
    }

    // Redirigir al panel (o a la ruta indicada)
    // IMPORTANTE: Usar allowedAppUrl para mantener el dominio correcto
    // Las cookies ya están seteadas por exchangeCodeForSession
    return NextResponse.redirect(new URL(redirectTo, allowedAppUrl));
  } catch (err: any) {
    console.error("Error inesperado en callback:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado al procesar la autenticación." },
      { status: 500 }
    );
  }
}
