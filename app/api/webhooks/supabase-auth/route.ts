/**
 * API Route: Supabase Webhook Handler (Auth Hooks + Database Webhooks)
 * 
 * Endpoint para recibir webhooks de Supabase:
 * 
 * 1. Auth Hooks (POST_SIGN_IN, POST_CONFIRMATION)
 * 2. Database Webhooks (INSERT, UPDATE, DELETE en auth.users)
 * 
 * Este endpoint se ejecuta automáticamente cuando:
 * - Un usuario confirma su email mediante Magic Link (POST_CONFIRMATION o UPDATE en auth.users)
 * - Un usuario inicia sesión (POST_SIGN_IN o UPDATE en auth.users con last_sign_in_at)
 * 
 * IMPORTANTE: Los webhooks se ejecutan en el servidor y NO pueden establecer cookies
 * para el cliente que hizo clic en el magic link. Su propósito es:
 * 
 * 1. Actualizar auth_login_requests para que el frontend detecte el cambio
 * 2. Sincronizar el estado de autenticación entre dispositivos
 * 3. Permitir que la ventana original detecte el login sin polling agresivo
 * 
 * La sesión se establece cuando el cliente procesa el callback:
 * - /auth/remote-callback usa exchangeCodeForSession() que establece las cookies automáticamente
 * - /auth/magic-link-handler llama a /api/auth/login/approve que establece la sesión
 * 
 * Seguridad:
 * - Valida que el request viene de Supabase usando SUPABASE_WEBHOOK_SECRET
 * - Usa service_role para actualizar auth_login_requests
 * - No expone tokens sensibles en logs
 */
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth Hook payload (POST_SIGN_IN, POST_CONFIRMATION)
type SupabaseAuthHookPayload = {
  type: "POST_SIGN_IN" | "POST_CONFIRMATION" | "POST_USER_CREATED";
  table: string;
  record: {
    id: string;
    email?: string;
    email_confirmed_at?: string;
    last_sign_in_at?: string;
    created_at?: string;
    [key: string]: any;
  };
  old_record: {
    id: string;
    [key: string]: any;
  } | null;
};

// Database Webhook payload (INSERT, UPDATE, DELETE)
type SupabaseDatabaseWebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: {
    id: string;
    email?: string;
    email_confirmed_at?: string;
    last_sign_in_at?: string;
    created_at?: string;
    [key: string]: any;
  } | null;
  old_record: {
    id: string;
    email?: string;
    email_confirmed_at?: string;
    last_sign_in_at?: string;
    [key: string]: any;
  } | null;
};

type SupabaseWebhookPayload = SupabaseAuthHookPayload | SupabaseDatabaseWebhookPayload;

export async function POST(req: NextRequest) {
  try {
    // Validar que el request viene de Supabase
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[SupabaseWebhook] SUPABASE_WEBHOOK_SECRET no configurado");
      return NextResponse.json(
        { error: "Webhook secret no configurado" },
        { status: 500 }
      );
    }

    // Validar autorización (Supabase envía el secret en el header Authorization)
    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.warn("[SupabaseWebhook] Invalid authorization header");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parsear el payload
    const payload: SupabaseWebhookPayload = await req.json();

    // Determinar si es Auth Hook o Database Webhook
    const isAuthHook = payload.type === "POST_SIGN_IN" || payload.type === "POST_CONFIRMATION" || payload.type === "POST_USER_CREATED";
    const isDatabaseWebhook = payload.type === "INSERT" || payload.type === "UPDATE" || payload.type === "DELETE";
    
    // Solo procesar eventos relevantes
    if (!isAuthHook && !isDatabaseWebhook) {
      console.log("[SupabaseWebhook] Ignoring unknown hook type:", payload.type);
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Para Database Webhooks, solo procesar UPDATE en auth.users
    // Nota: Supabase puede enviar "users" o "auth.users" dependiendo de la configuración
    if (isDatabaseWebhook) {
      const isAuthUsersTable = payload.table === "auth.users" || payload.table === "users";
      if (!isAuthUsersTable || payload.type !== "UPDATE") {
        console.log("[SupabaseWebhook] Ignoring database webhook:", { table: payload.table, type: payload.type });
        return NextResponse.json({ ok: true, ignored: true });
      }

      // Procesar si hay un UPDATE en auth.users
      // Nota: Puede que no siempre detectemos cambios específicos, pero si hay un UPDATE
      // y hay una request pendiente, es probable que sea un sign-in
      const oldRecord = (payload as SupabaseDatabaseWebhookPayload).old_record;
      const newRecord = (payload as SupabaseDatabaseWebhookPayload).record;
      
      if (!newRecord) {
        console.log("[SupabaseWebhook] No record in database webhook");
        return NextResponse.json({ ok: true, skipped: "no_record" });
      }

      // Verificar cambios específicos (pero no bloquear si no los hay)
      const lastSignInChanged = oldRecord?.last_sign_in_at !== newRecord.last_sign_in_at;
      const emailConfirmedChanged = !oldRecord?.email_confirmed_at && !!newRecord.email_confirmed_at;
      
      // Si hay un last_sign_in_at en el nuevo record, es un sign-in
      const hasLastSignIn = !!newRecord.last_sign_in_at;
      const hasEmailConfirmed = !!newRecord.email_confirmed_at;

      // Log detallado para debugging
      console.log("[SupabaseWebhook] Database webhook - auth.users UPDATE:", {
        userId: newRecord.id,
        email: newRecord.email ? "present" : "missing",
        lastSignInChanged,
        emailConfirmedChanged,
        hasLastSignIn,
        hasEmailConfirmed,
        oldLastSignIn: oldRecord?.last_sign_in_at || null,
        newLastSignIn: newRecord.last_sign_in_at || null,
      });

      // Si no hay cambios detectados pero hay un last_sign_in_at, procesar de todos modos
      // (puede ser que el old_record no tenga la información completa)
      if (!lastSignInChanged && !emailConfirmedChanged && !hasLastSignIn) {
        console.log("[SupabaseWebhook] No relevant changes in auth.users update and no last_sign_in_at");
        return NextResponse.json({ ok: true, skipped: "no_relevant_changes" });
      }
    } else {
      // Auth Hook
      const authPayload = payload as SupabaseAuthHookPayload;
      console.log("[SupabaseWebhook] Auth hook:", {
        type: authPayload.type,
        userId: authPayload.record.id,
        email: authPayload.record.email ? "present" : "missing",
        hasEmailConfirmed: !!authPayload.record.email_confirmed_at,
        hasLastSignIn: !!authPayload.record.last_sign_in_at,
      });

      // Solo procesar POST_SIGN_IN y POST_CONFIRMATION
      if (authPayload.type !== "POST_SIGN_IN" && authPayload.type !== "POST_CONFIRMATION") {
        console.log("[SupabaseWebhook] Ignoring auth hook type:", authPayload.type);
        return NextResponse.json({ ok: true, ignored: true });
      }
    }

    // Extraer email del usuario
    const record = isDatabaseWebhook 
      ? (payload as SupabaseDatabaseWebhookPayload).record 
      : (payload as SupabaseAuthHookPayload).record;
    
    if (!record) {
      console.warn("[SupabaseWebhook] No record in payload");
      return NextResponse.json({ ok: true, skipped: "no_record" });
    }
    
    const userEmail = record.email;
    if (!userEmail) {
      console.warn("[SupabaseWebhook] No email in payload");
      return NextResponse.json({ ok: true, skipped: "no_email" });
    }

    // Usar service role para actualizar auth_login_requests
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

    // Buscar la request pendiente más reciente para este email (últimos 15 minutos)
    // Aumentamos el tiempo a 30 minutos para dar más margen
    const { data: pendingRequest, error: lookupError } = await supabaseAdmin
      .from("auth_login_requests")
      .select("id, email, status, created_at, redirect_path")
      .eq("email", userEmail.toLowerCase())
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[SupabaseWebhook] Error looking up request:", lookupError);
      // No fallar el webhook, solo loguear el error
      return NextResponse.json({ ok: true, error: "lookup_failed" });
    }

    if (!pendingRequest) {
      console.log("[SupabaseWebhook] No pending request found for email:", userEmail);
      // No hay request pendiente, esto es normal (puede ser un login directo)
      return NextResponse.json({ ok: true, skipped: "no_pending_request" });
    }

    // Actualizar la request como "approved"
    // 
    // IMPORTANTE: Los webhooks NO pueden establecer cookies para el cliente.
    // La sesión se establece cuando el cliente procesa el callback:
    // - Si el cliente tiene el code en la URL, /auth/remote-callback usa exchangeCodeForSession()
    // - Si el cliente tiene tokens en el hash, /auth/magic-link-handler los procesa
    // 
    // Este hook solo marca la request como aprobada para que el frontend detecte el cambio
    // y sepa que puede proceder a establecer la sesión usando los tokens disponibles.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("auth_login_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        // Los tokens (access_token, refresh_token) se establecerán cuando el cliente
        // procese el callback y llame a /api/auth/login-request/update o /api/auth/login/approve
      })
      .eq("id", pendingRequest.id)
      .eq("status", "pending")
      .select()
      .single();

    if (updateError) {
      console.error("[SupabaseWebhook] Error updating request:", updateError);
      // No fallar el webhook, solo loguear el error
      return NextResponse.json({ ok: true, error: "update_failed" });
    }

    console.log("[SupabaseWebhook] Request marked as approved:", {
      requestId: updated.id,
      email: updated.email,
      redirectPath: updated.redirect_path,
      hookType: isAuthHook ? "Auth Hook" : "Database Webhook",
    });

    // Retornar éxito (Supabase reintentará si no recibe 200)
    return NextResponse.json({
      ok: true,
      processed: true,
      requestId: updated.id,
      message: "Login request marked as approved",
    });
  } catch (err: any) {
    console.error("[SupabaseWebhook] Unexpected error:", err);
    // Siempre retornar 200 para que Supabase no reintente
    // Los errores se loguean pero no bloquean la respuesta
    return NextResponse.json({
      ok: true,
      error: "unexpected_error",
      message: err?.message || "Error inesperado",
    });
  }
}

