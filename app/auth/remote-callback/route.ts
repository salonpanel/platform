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
  const type = url.searchParams.get("type");
  const token = url.searchParams.get("token"); // Token de Supabase (diferente de secretToken)

  // Log inicial con todos los parámetros que llegan
  console.log("[remote-callback] Request received", {
    code: code ? `${code.substring(0, 10)}...` : null,
    requestId: requestId || null,
    secretToken: secretToken ? "present" : "missing",
    type: type || null,
    supabaseToken: token ? "present" : "missing",
    fullUrl: url.toString(),
    searchParams: Array.from(url.searchParams.entries()),
  });

  // Si no tenemos code, puede estar en el hash (PKCE flow)
  // Redirigir a magic-link-handler que puede leer el hash en el cliente
  if (!code) {
    console.log("[remote-callback] No code in query params, redirecting to magic-link-handler (PKCE flow - code may be in hash)");
    
    // Si tenemos request_id y token, redirigir a magic-link-handler
    if (requestId && secretToken) {
      const handlerUrl = new URL("/auth/magic-link-handler", url.origin);
      handlerUrl.searchParams.set("request_id", requestId);
      handlerUrl.searchParams.set("token", secretToken);
      if (type) handlerUrl.searchParams.set("type", type);
      if (token && token !== secretToken) handlerUrl.searchParams.set("supabase_token", token);
      return NextResponse.redirect(handlerUrl);
    }
    
    // Si no tenemos request_id o token, error
    console.error("[remote-callback] Missing code and missing request_id/token - redirecting to login");
    return NextResponse.redirect(
      new URL("/login?error=invalid_link&details=no_code_no_params", url.origin)
    );
  }

  // Si tenemos code, procesar normalmente
  let needsRequestLookup = !requestId || !secretToken;

  try {
    console.log("[remote-callback] Step 1: Creating Supabase client");
    // En Next.js 16, cookies() NO es async en route handlers, se pasa directamente
    // (igual que en app/auth/callback/route.ts que funciona correctamente)
    const supabase = createRouteHandlerClient({ cookies });
    
    console.log("[remote-callback] Step 2: Exchanging code for session", {
      codeLength: code.length,
      hasRequestId: !!requestId,
      hasSecretToken: !!secretToken,
    });
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const session = data?.session;
    const sessionError = error;

    if (sessionError) {
      console.error("[remote-callback] exchangeCodeForSession error", {
        errorMessage: sessionError.message,
        errorName: sessionError.name,
        errorStatus: sessionError.status,
        hasCode: !!code,
        codeLength: code?.length,
      });
      return NextResponse.redirect(
        new URL(`/login?error=invalid_session&details=${encodeURIComponent(sessionError.message || 'unknown')}`, url.origin)
      );
    }

    if (!session) {
      console.error("[remote-callback] No session returned after exchangeCodeForSession", {
        hasData: !!data,
        hasSession: !!data?.session,
      });
      return NextResponse.redirect(
        new URL("/login?error=no_session", url.origin)
      );
    }

    const { access_token, refresh_token, user } = session;
    
    console.log("[remote-callback] session", {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
    });

    if (!user?.email) {
      console.error("[remote-callback] No user email in session");
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=no_email", url.origin)
      );
    }

    // 2) Si no tenemos requestId o secretToken, buscar la request pendiente más reciente para este email
    console.log("[remote-callback] Step 3: Creating admin client for database operations");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[remote-callback] Missing Supabase credentials", {
        hasUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=server_config", url.origin)
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let finalRequestId = requestId;
    let finalSecretToken = secretToken;

    if (needsRequestLookup) {
      console.log("[remote-callback] Looking up pending request for email:", user.email);
      
      // Buscar la request pendiente más reciente para este email (últimos 15 minutos)
      const { data: pendingRequest, error: lookupError } = await admin
        .from("auth_login_requests")
        .select("id, secret_token, created_at")
        .eq("email", user.email.toLowerCase())
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Últimos 15 minutos
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError || !pendingRequest) {
        console.error("[remote-callback] No pending request found for email:", user.email, lookupError);
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=no_pending_request", url.origin)
        );
      }

      finalRequestId = pendingRequest.id;
      finalSecretToken = pendingRequest.secret_token;
      
      console.log("[remote-callback] Found pending request:", {
        requestId: finalRequestId,
        created_at: pendingRequest.created_at,
      });
    }

    console.log("[remote-callback] Updating login request", {
      requestId: finalRequestId,
      secretToken: finalSecretToken ? "present" : "missing",
    });

    const { data: updated, error: updateError } = await admin
      .from("auth_login_requests")
      .update({
        status: "approved",
        // IMPORTANTE: usar fecha válida en formato ISO, no "now()" como string
        approved_at: new Date().toISOString(),
        supabase_access_token: access_token,
        supabase_refresh_token: refresh_token,
        email: user.email,
      })
      .eq("id", finalRequestId)
      .eq("secret_token", finalSecretToken)
      .eq("status", "pending")
      .select()
      .single();

    if (updateError) {
      console.error("[remote-callback] updateError", updateError, {
        requestId: finalRequestId,
        secretToken: finalSecretToken ? "present" : "missing",
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
        requestId: finalRequestId,
        secretToken: finalSecretToken ? "present" : "missing",
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
    console.error("[remote-callback] Unexpected error:", {
      errorMessage: err?.message,
      errorName: err?.name,
      errorStack: err?.stack,
      errorDetails: err,
      url: url.toString(),
      hasCode: !!code,
      hasRequestId: !!requestId,
      hasSecretToken: !!secretToken,
    });
    
    // Intentar cerrar sesión si hay un cliente de Supabase activo
    try {
      const supabase = createRouteHandlerClient({ cookies });
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.warn("[remote-callback] Error during cleanup signOut:", signOutError);
    }
    
    return NextResponse.redirect(
      new URL(`/login?error=unexpected&details=${encodeURIComponent(err?.message || 'unknown_error')}`, url.origin)
    );
  }
}
