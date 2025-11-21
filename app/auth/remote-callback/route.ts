/**
 * Handler de callback para aprobación remota de login
 * 
 * Este endpoint se ejecuta cuando el usuario hace clic en el magic link desde otro dispositivo (móvil).
 * 
 * FLUJO:
 * 1. Usuario hace clic en magic link desde móvil
 * 2. Supabase redirige aquí con ?code=...
 * 3. Intercambiamos el código por una sesión temporal en el móvil
 * 4. Guardamos los tokens en auth_login_requests usando service_role
 * 5. Cerramos la sesión en el dispositivo móvil
 * 6. Redirigimos a una página de confirmación
 * 
 * IMPORTANTE: El dispositivo móvil NO se queda logueado
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const requestId = url.searchParams.get("request_id");
  const secretToken = url.searchParams.get("token");

  // Log inicial con todos los parámetros que llegan
  console.log("[RemoteCallback] Incoming params", {
    code: code ? "present" : "missing",
    requestId,
    secretToken: secretToken ? "present" : "missing",
    fullUrl: url.toString(),
  });

  if (!code || !requestId || !secretToken) {
    console.error("[remote-callback] Missing required params:", { code: !!code, requestId, secretToken: !!secretToken });
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", url.origin)
    );
  }

  try {
    // 1) Intercambiar code por session en ESTE dispositivo (móvil)
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session) {
      console.error("[remote-callback] exchangeCodeForSession error", error);
      return NextResponse.redirect(
        new URL("/login?error=invalid_session", url.origin)
      );
    }

    const { access_token, refresh_token, user } = data.session;
    
    console.log("[RemoteCallback] Session obtained", {
      userId: user?.id,
      email: user?.email,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
    });

    // 2) Actualizar la request con tokens mediante SERVICE_ROLE
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[RemoteCallback] Updating login request", {
      requestId,
      secretToken: secretToken ? "present" : "missing",
    });

    const { data: updated, error: updateError } = await admin
      .from("auth_login_requests")
      .update({
        status: "approved",
        // IMPORTANTE: usar fecha válida, no "now()" como string
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

    if (updateError || !updated) {
      console.error("[remote-callback] update error", updateError, { requestId, secretToken });
      // si falla el update, mejor informar que el enlace no es válido
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=update_failed", url.origin)
      );
    }

    console.log("[remote-callback] login_request approved", {
      id: updated.id,
      email: updated.email,
      status: updated.status,
    });

    // 3) Cerrar sesión en este dispositivo (no queremos sesión en el móvil)
    await supabase.auth.signOut();

    // 4) Redirigir a una página simple de confirmación
    return NextResponse.redirect(
      new URL("/auth/remote-confirmed", url.origin)
    );
  } catch (err: any) {
    console.error("[remote-callback] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/login?error=unexpected", url.origin)
    );
  }
}
