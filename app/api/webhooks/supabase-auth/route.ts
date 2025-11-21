/**
 * API Route: Supabase Webhook Handler (Auth Hooks + Database Webhooks)
 * 
 * Endpoint para recibir webhooks de Supabase para auditoría y logging.
 * 
 * Con el sistema OTP, este webhook solo registra eventos de autenticación
 * para auditoría. Ya no actualiza auth_login_requests (sistema obsoleto de Magic Link).
 * 
 * Seguridad:
 * - Valida que el request viene de Supabase usando SUPABASE_WEBHOOK_SECRET
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

    // Extraer información del usuario
    let userEmail: string | undefined;
    let hookType: string;

    if (isDatabaseWebhook) {
      hookType = "Database Webhook";
      // Solo procesar UPDATE en auth.users
      if (!["users", "auth.users"].includes(payload.table) || payload.type !== "UPDATE") {
        console.log("[SupabaseWebhook] Ignoring database webhook:", { table: payload.table, type: payload.type });
        return NextResponse.json({ ok: true, ignored: true });
      }

      const oldRecord = (payload as SupabaseDatabaseWebhookPayload).old_record;
      const newRecord = (payload as SupabaseDatabaseWebhookPayload).record;
      
      if (!newRecord) {
        console.log("[SupabaseWebhook] No record in database webhook");
        return NextResponse.json({ ok: true, skipped: "no_record" });
      }

      const oldLastSignIn = oldRecord?.last_sign_in_at;
      const newLastSignIn = newRecord.last_sign_in_at;
      const lastSignInChanged = oldLastSignIn !== newLastSignIn;

      // Solo registrar si hay un cambio en last_sign_in_at (login)
      if (!lastSignInChanged) {
        console.log("[SupabaseWebhook] No sign-in change detected");
        return NextResponse.json({ ok: true, skipped: "no_sign_in_change" });
      }

      console.log("[SupabaseWebhook] Database webhook - User sign-in detected:", {
        userId: newRecord.id,
        email: newRecord.email ? "present" : "missing",
        lastSignInChanged: true,
      });
      userEmail = newRecord.email;

    } else {
      hookType = "Auth Hook";
      const authPayload = payload as SupabaseAuthHookPayload;
      
      if (authPayload.type !== "POST_SIGN_IN" && authPayload.type !== "POST_CONFIRMATION") {
        console.log("[SupabaseWebhook] Ignoring auth hook type:", authPayload.type);
        return NextResponse.json({ ok: true, ignored: true });
      }

      console.log("[SupabaseWebhook] Auth hook - User event:", {
        type: authPayload.type,
        userId: authPayload.record.id,
        email: authPayload.record.email ? "present" : "missing",
        hasEmailConfirmed: !!authPayload.record.email_confirmed_at,
        hasLastSignIn: !!authPayload.record.last_sign_in_at,
      });
      userEmail = authPayload.record.email;
    }

    if (!userEmail) {
      console.warn("[SupabaseWebhook] No email in payload");
      return NextResponse.json({ ok: true, skipped: "no_email" });
    }

    // Solo registrar el evento para auditoría
    // Con OTP, no necesitamos actualizar auth_login_requests
    console.log("[SupabaseWebhook] Authentication event logged:", {
      hookType,
      email: userEmail,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      processed: true,
      message: "Authentication event logged",
    });
  } catch (err: any) {
    console.error("[SupabaseWebhook] Unexpected error:", err);
    return NextResponse.json({
      ok: true,
      error: "unexpected_error",
      message: err?.message || "Error inesperado",
    });
  }
}
