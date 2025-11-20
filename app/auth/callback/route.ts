/**
 * Handler de callback para autenticación con Magic Links de Supabase
 * 
 * Este endpoint maneja la redirección después de que el usuario hace clic en el magic link
 * enviado por email.
 * 
 * FLUJO ESPERADO:
 * 1. El usuario recibe un email con un magic link de Supabase
 * 2. El link puede venir en dos formatos:
 *    a) Con hash (#access_token=...&refresh_token=...) - típico de magic links
 *    b) Con query param (?code=...) - usado con PKCE o redirects del servidor
 * 3. Si viene con hash, el cliente (navegador) debe extraerlo y pasarlo como query param
 *    antes de redirigir a este endpoint, ya que el hash NO está disponible en el servidor
 * 4. Este handler intercambia el código/token por una sesión y redirige al usuario
 * 
 * CASOS DE ERROR MANEJADOS:
 * - NEXT_PUBLIC_APP_URL no configurado: en dev, se infiere de la request; en prod, error 500
 * - Host/origen inválido: en prod, verificación estricta; en dev, más flexible
 * - Código/token ausente: error 400 con mensaje claro
 * - Código expirado o inválido: error 400 con sugerencia de solicitar nuevo link
 * - Error en logging de auth_logs: no rompe el flujo, solo warning en consola
 * 
 * NOTA: El logging en auth_logs es opcional y no debe interrumpir el flujo de autenticación
 * si falla (por ejemplo, si la tabla no existe o hay problemas de permisos RLS).
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

  // Buscar código en query params
  let code = url.searchParams.get("code");
  
  // También buscar access_token en query params (por si viene del cliente)
  let accessToken = url.searchParams.get("access_token");
  
  // Nota: El hash (#) no está disponible en el servidor, así que el cliente debe extraerlo
  // y pasarlo como query param antes de redirigir

  if (!code && !accessToken) {
    return NextResponse.json(
      { error: "Código de autenticación no proporcionado." },
      { status: 400 }
    );
  }

  try {
    // En Next.js 16+, cookies() es async, pero createRouteHandlerClient espera la función directamente
    const supabaseClient = createRouteHandlerClient({ cookies: async () => await cookies() });
    
    let data: any = null;
    let error: any = null;
    
    // Si tenemos access_token directamente, usarlo
    if (accessToken) {
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // Se obtendrá automáticamente
      });
      data = sessionData;
      error = sessionError;
    } else if (code) {
      // Intentar intercambiar el código por una sesión
      // Para Magic Links con emailRedirectTo, Supabase puede requerir PKCE
      // Si falla, intentaremos métodos alternativos
      const result = await supabaseClient.auth.exchangeCodeForSession(code);
      data = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error("Error al intercambiar código por sesión:", error);
      console.error("Detalles del error:", JSON.stringify(error, null, 2));
      
      // Si el error es de PKCE o token inválido, el código puede haber expirado
      // o el code_verifier no está disponible
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
    
    // Intentar registrar en auth_logs (opcional, no debe romper el flujo si falla)
    if (session?.user?.id) {
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

    // Redirigir según el redirect param o a /panel por defecto
    const redirectTo = url.searchParams.get("redirect") || "/panel";
    return NextResponse.redirect(new URL(redirectTo, allowedAppUrl));
  } catch (err: any) {
    console.error("Error inesperado en callback:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado al procesar la autenticación." },
      { status: 500 }
    );
  }
}

