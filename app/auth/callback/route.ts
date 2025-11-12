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

  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Código de autenticación no proporcionado." },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Intentar intercambiar el código por una sesión
    // Para Magic Links con emailRedirectTo, Supabase puede requerir PKCE
    // Si falla, intentaremos métodos alternativos
    let { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
    
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

