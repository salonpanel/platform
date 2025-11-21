/**
 * API Route: Supabase Auth Hook Handler
 * 
 * Endpoint para recibir webhooks de Supabase Auth Hooks (POST_SIGN_IN, POST_CONFIRMATION)
 * 
 * Este endpoint se ejecuta automáticamente cuando:
 * - Un usuario confirma su email mediante Magic Link (POST_CONFIRMATION)
 * - Un usuario inicia sesión (POST_SIGN_IN)
 * 
 * Propósito:
 * - Actualizar automáticamente auth_login_requests cuando se detecta un sign-in
 * - Permitir que la ventana original detecte el login sin necesidad de polling agresivo
 * - Sincronizar el estado de autenticación entre dispositivos
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

export async function POST(req: NextRequest) {
  try {
    // Validar que el request viene de Supabase
    const headersList = await headers();
    const authHeader = headersList.get("authorization");
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("[SupabaseAuthHook] SUPABASE_WEBHOOK_SECRET no configurado");
      return NextResponse.json(
        { error: "Webhook secret no configurado" },
        { status: 500 }
      );
    }

    // Validar autorización (Supabase envía el secret en el header Authorization)
    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.warn("[SupabaseAuthHook] Invalid authorization header");
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parsear el payload
    const payload: SupabaseAuthHookPayload = await req.json();

    console.log("[SupabaseAuthHook] Received hook:", {
      type: payload.type,
      userId: payload.record.id,
      email: payload.record.email ? "present" : "missing",
      hasEmailConfirmed: !!payload.record.email_confirmed_at,
      hasLastSignIn: !!payload.record.last_sign_in_at,
    });

    // Solo procesar POST_SIGN_IN y POST_CONFIRMATION
    if (payload.type !== "POST_SIGN_IN" && payload.type !== "POST_CONFIRMATION") {
      console.log("[SupabaseAuthHook] Ignoring hook type:", payload.type);
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Extraer email del usuario
    const userEmail = payload.record.email;
    if (!userEmail) {
      console.warn("[SupabaseAuthHook] No email in payload");
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
    const { data: pendingRequest, error: lookupError } = await supabaseAdmin
      .from("auth_login_requests")
      .select("id, email, status, created_at, redirect_path")
      .eq("email", userEmail.toLowerCase())
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[SupabaseAuthHook] Error looking up request:", lookupError);
      // No fallar el webhook, solo loguear el error
      return NextResponse.json({ ok: true, error: "lookup_failed" });
    }

    if (!pendingRequest) {
      console.log("[SupabaseAuthHook] No pending request found for email:", userEmail);
      // No hay request pendiente, esto es normal (puede ser un login directo)
      return NextResponse.json({ ok: true, skipped: "no_pending_request" });
    }

    // Actualizar la request como "approved"
    // Nota: No tenemos los tokens aquí porque el hook se ejecuta antes de que se establezcan
    // Los tokens se establecerán cuando el cliente llame a /api/auth/login-request/update
    // Pero marcamos la request como aprobada para que el frontend sepa que el login fue exitoso
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("auth_login_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        // Los tokens se establecerán después cuando el cliente procese el callback
      })
      .eq("id", pendingRequest.id)
      .eq("status", "pending")
      .select()
      .single();

    if (updateError) {
      console.error("[SupabaseAuthHook] Error updating request:", updateError);
      // No fallar el webhook, solo loguear el error
      return NextResponse.json({ ok: true, error: "update_failed" });
    }

    console.log("[SupabaseAuthHook] Request marked as approved:", {
      requestId: updated.id,
      email: updated.email,
      redirectPath: updated.redirect_path,
    });

    // Retornar éxito (Supabase reintentará si no recibe 200)
    return NextResponse.json({
      ok: true,
      processed: true,
      requestId: updated.id,
      message: "Login request marked as approved",
    });
  } catch (err: any) {
    console.error("[SupabaseAuthHook] Unexpected error:", err);
    // Siempre retornar 200 para que Supabase no reintente
    // Los errores se loguean pero no bloquean la respuesta
    return NextResponse.json({
      ok: true,
      error: "unexpected_error",
      message: err?.message || "Error inesperado",
    });
  }
}

