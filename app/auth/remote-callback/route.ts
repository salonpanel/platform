/**
 * Handler de callback para aprobación remota de login
 * 
 * Este endpoint se ejecuta cuando el usuario hace clic en el magic link desde otro dispositivo (móvil).
 * 
 * FLUJO:
 * 1. Usuario hace clic en magic link desde móvil
 * 2. Supabase puede redirigir directamente aquí O pasar por su propio verify primero
 * 3. Si viene con code: intercambiamos el código por una sesión temporal
 * 4. Si viene con token: necesitamos procesarlo de otra forma
 * 5. Guardamos los tokens en auth_login_requests usando service_role
 * 6. Cerramos la sesión en el dispositivo móvil
 * 7. Redirigimos a una página de confirmación
 * 
 * IMPORTANTE: El dispositivo móvil NO se queda logueado
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const requestId = url.searchParams.get("request_id");
  const secretToken = url.searchParams.get("token");
  
  // También buscar token de Supabase (cuando viene directamente desde el magic link)
  // NOTA: Si Supabase redirige directamente, puede que el token esté en el hash (#) en lugar de query params
  const supabaseToken = url.searchParams.get("token");
  const type = url.searchParams.get("type");
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");

  console.log("[RemoteCallback] Received request:", { 
    hasCode: !!code, 
    hasRequestId: !!requestId, 
    hasSecretToken: !!secretToken,
    hasSupabaseToken: !!supabaseToken,
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    type,
    fullUrl: url.toString()
  });

  // Validar parámetros requeridos
  if (!requestId || !secretToken) {
    console.error("[RemoteCallback] Missing required params:", { requestId: !!requestId, secretToken: !!secretToken });
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", url.origin)
    );
  }

  // CASO ESPECIAL: Si Supabase redirige directamente con access_token y refresh_token (sin code)
  // Esto puede pasar si Supabase procesa el token automáticamente
  if (!code && accessToken && refreshToken) {
    console.log("[RemoteCallback] Direct tokens received from Supabase, updating request directly");
    
    try {
      // Actualizar la request directamente con los tokens
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      // Obtener información del usuario desde el token
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
      
      if (userError || !user) {
        console.error("[RemoteCallback] Error getting user from token:", userError);
        return NextResponse.redirect(
          new URL("/login?error=invalid_token", url.origin)
        );
      }

      console.log("[RemoteCallback] Updating login request with direct tokens:", { requestId, userId: user.id });
      
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("auth_login_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          supabase_access_token: accessToken,
          supabase_refresh_token: refreshToken,
          email: user.email ?? null,
        })
        .eq("id", requestId)
        .eq("secret_token", secretToken)
        .eq("status", "pending")
        .select()
        .single();

      if (updateError) {
        console.error("[RemoteCallback] Error updating login request:", updateError);
        return NextResponse.redirect(
          new URL("/auth/remote-confirmed?error=update_failed", url.origin)
        );
      }

      if (!updated) {
        console.warn("[RemoteCallback] Request not found or already processed:", { requestId, secretToken });
        return NextResponse.redirect(
          new URL("/auth/remote-confirmed?error=already_approved", url.origin)
        );
      }

      console.log("[RemoteCallback] Request updated successfully with direct tokens:", { requestId, status: updated.status });

      // Redirigir a página de confirmación
      return NextResponse.redirect(
        new URL("/auth/remote-confirmed", url.origin)
      );
    } catch (err: any) {
      console.error("[RemoteCallback] Unexpected error processing direct tokens:", err);
      return NextResponse.redirect(
        new URL("/login?error=unexpected", url.origin)
      );
    }
  }

  // Si no hay code pero hay token de Supabase, Supabase está usando su propio flujo
  // En este caso, necesitamos que Supabase procese el token primero
  if (!code && supabaseToken && type === "magiclink") {
    console.log("[RemoteCallback] Magic link detected without code, Supabase needs to verify first");
    
    // Construir URL de Supabase para verificación que luego redirija a nuestro callback
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const verifyUrl = new URL(`/auth/v1/verify`, supabaseUrl);
      verifyUrl.searchParams.set("token", supabaseToken);
      verifyUrl.searchParams.set("type", type);
      
      // IMPORTANTE: Configurar redirect_to para que Supabase redirija a nuestro callback con todos los params
      const redirectTo = new URL("/auth/remote-callback", url.origin);
      redirectTo.searchParams.set("request_id", requestId);
      redirectTo.searchParams.set("token", secretToken); // Nuestro secret token
      verifyUrl.searchParams.set("redirect_to", redirectTo.toString());
      
      console.log("[RemoteCallback] Redirecting to Supabase verify:", verifyUrl.toString());
      return NextResponse.redirect(verifyUrl);
    }
  }

  // Si no hay code y no hay token de Supabase, error
  if (!code) {
    console.error("[RemoteCallback] No code and no Supabase token to process");
    return NextResponse.redirect(
      new URL("/login?error=no_code", url.origin)
    );
  }

  try {
    // 1) Intercambiar código por sesión (en este dispositivo móvil)
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error("[RemoteCallback] Error exchanging code for session:", error);
      return NextResponse.redirect(
        new URL("/login?error=invalid_session", url.origin)
      );
    }

    const { access_token, refresh_token, user } = data.session;

    // 2) Actualizar la request con tokens mediante SERVICE_ROLE
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[RemoteCallback] Updating login request:", { requestId, hasTokens: !!(access_token && refresh_token) });
    
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("auth_login_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        supabase_access_token: access_token,
        supabase_refresh_token: refresh_token,
        email: user?.email ?? null,
      })
      .eq("id", requestId)
      .eq("secret_token", secretToken)
      .eq("status", "pending")
      .select()
      .single();

    if (updateError) {
      console.error("[RemoteCallback] Error updating login request:", updateError);
      return NextResponse.redirect(
        new URL("/auth/remote-confirmed?error=update_failed", url.origin)
      );
    }

    if (!updated) {
      console.warn("[RemoteCallback] Request not found or already processed:", { requestId, secretToken });
      // Si la request ya fue aprobada o no existe, mostrar mensaje apropiado
      return NextResponse.redirect(
        new URL("/auth/remote-confirmed?error=already_approved", url.origin)
      );
    }

    console.log("[RemoteCallback] Request updated successfully:", { requestId, status: updated.status });

    // 3) Cerrar sesión en este dispositivo (no queremos sesión en el móvil)
    await supabase.auth.signOut();

    // 4) Redirigir a página de confirmación
    return NextResponse.redirect(
      new URL("/auth/remote-confirmed", url.origin)
    );
  } catch (err: any) {
    console.error("[RemoteCallback] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/login?error=unexpected", url.origin)
    );
  }
}
