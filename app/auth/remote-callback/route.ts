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
  console.log("[remote-callback] params", {
    code: code || null,
    requestId: requestId || null,
    secretToken: secretToken ? "present" : "missing",
    fullUrl: url.toString(),
  });

  if (!code || !requestId || !secretToken) {
    console.error("[remote-callback] Missing required params:", { 
      code: !!code, 
      requestId: requestId || null, 
      secretToken: !!secretToken 
    });
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
    
    console.log("[remote-callback] session", {
      hasSession: !!data?.session,
      userId: data?.session?.user?.id,
      email: data?.session?.user?.email,
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

    console.log("[remote-callback] Updating login request", {
      requestId,
      secretToken: secretToken ? "present" : "missing",
    });

    const { data: updated, error: updateError } = await admin
      .from("auth_login_requests")
      .update({
        status: "approved",
        // IMPORTANTE: usar fecha válida en formato ISO, no "now()" como string
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
      console.error("[remote-callback] updateError", updateError, {
        requestId,
        secretToken: secretToken ? "present" : "missing",
        errorMessage: updateError.message,
        errorDetails: updateError.details,
        errorHint: updateError.hint,
      });
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=update_failed", url.origin)
      );
    }

    if (!updated) {
      console.error("[remote-callback] update returned no rows", {
        requestId,
        secretToken: secretToken ? "present" : "missing",
        message: "Login request not found or already processed",
      });
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=login_request_not_found", url.origin)
      );
    }

    console.log("[remote-callback] updated login request", {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      approved_at: updated.approved_at,
      hasAccessToken: !!updated.supabase_access_token,
      hasRefreshToken: !!updated.supabase_refresh_token,
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
