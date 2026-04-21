/**
 * POST /api/asistente/chat
 *
 * Endpoint del chat del asistente BookFast AI.
 *
 * Flujo:
 *   1) Auth: supabase.auth.getUser()
 *   2) Parse + validación del body
 *   3) Membership + rol del usuario en un tenant
 *   4) Verificar asistente_enabled del tenant
 *   5) Guardrails: kill switch + budget + rate limit + sanitización
 *   6) Resolver o crear sesión
 *   7) Persistir mensaje del usuario
 *   8) Cargar historial previo de la sesión
 *   9) runAssistantTurn (LLM + tool-use loop + persist de pasos)
 *  10) Actualizar last_message_at
 *  11) Responder
 *
 * Errores conocidos:
 *   - 401: no autenticado
 *   - 400: body inválido / mensaje vacío
 *   - 403: sin tenant / asistente deshabilitado / sesión de otro usuario
 *   - 429: rate limited
 *   - 402: budget excedido
 *   - 503: kill switch / proveedor LLM no disponible
 *   - 500: fallo interno (session create, DB, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ModelMessage } from "ai";

import { createClientForServer } from "@/lib/supabase/server-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/rate-limit";
import {
  runChatGuardrails,
  logAudit,
  logSecurityEvent,
} from "@/lib/asistente/security";
import { runAssistantTurn } from "@/lib/asistente/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatRequestSchema = z.object({
  message: z.string().min(1, "El mensaje no puede estar vacío"),
  sessionId: z.string().uuid().optional(),
});

type MembershipRow = {
  tenant_id: string;
  role: "owner" | "admin" | "manager" | "staff";
};

type TenantConfigRow = {
  asistente_enabled: boolean;
  asistente_autonomy_mode: "supervised" | "semi" | "autonomous";
};

/**
 * Máximo de mensajes previos que se envían al LLM como contexto.
 * Más = mejor memoria conversacional pero más tokens → más €.
 * 12 turns (user+assistant) es un buen punto medio para chat operativo.
 */
const MAX_PRIOR_MESSAGES = 12;

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const ip = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent") ?? null;

  // ── 1. Auth ────────────────────────────────────────────────────────────
  const supabaseAuth = await createClientForServer();
  const {
    data: { user },
    error: userErr,
  } = await supabaseAuth.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { error: "no_autenticado", message: "Debes iniciar sesión." },
      { status: 401 },
    );
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Cuerpo de petición inválido." },
      { status: 400 },
    );
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_input",
        message: parsed.error.issues[0]?.message ?? "Datos inválidos",
      },
      { status: 400 },
    );
  }

  // ── 3. Membership + rol ────────────────────────────────────────────────
  const { data: membershipData, error: memErr } = await supabaseAuth
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr || !membershipData) {
    return NextResponse.json(
      { error: "sin_tenant", message: "No tienes acceso a ningún negocio." },
      { status: 403 },
    );
  }

  const membership = membershipData as MembershipRow;
  const tenantId = membership.tenant_id;
  const userRole = membership.role;

  // ── 4. Verificar tenant ────────────────────────────────────────────────
  const { data: tenantRow } = await supabaseAuth
    .from("tenants")
    .select("asistente_enabled, asistente_autonomy_mode, name, timezone")
    .eq("id", tenantId)
    .maybeSingle();

  const tenantCfg = tenantRow as
    | (TenantConfigRow & { name: string; timezone: string | null })
    | null;

  if (!tenantCfg?.asistente_enabled) {
    await logSecurityEvent({
      tenantId,
      userId: user.id,
      sessionId: parsed.data.sessionId ?? null,
      eventType: "killswitch_hit",
      severity: "info",
      payload: { reason: "tenant_asistente_disabled" },
      ipAddress: ip,
      userAgent,
    });
    return NextResponse.json(
      {
        error: "asistente_deshabilitado",
        message:
          "El asistente no está habilitado para este negocio. Actívalo desde Ajustes → IA.",
      },
      { status: 403 },
    );
  }

  const tenantName = tenantCfg.name ?? "Tu negocio";
  const tenantTimezone = tenantCfg.timezone ?? "Europe/Madrid";

  // ── 5. Guardrails ──────────────────────────────────────────────────────
  const guardrails = await runChatGuardrails({
    tenantId,
    userId: user.id,
    userRole,
    sessionId: parsed.data.sessionId ?? null,
    ipAddress: ip,
    userAgent,
    message: parsed.data.message,
  });

  if (!guardrails.allowed) {
    await logAudit({
      tenantId,
      userId: user.id,
      sessionId: parsed.data.sessionId ?? null,
      actionType: guardrails.reason?.startsWith("rate_limited")
        ? "rate_limited"
        : guardrails.reason === "budget_exceeded"
          ? "budget_blocked"
          : "killswitch_blocked",
      status: "denied",
      reason: guardrails.reason ?? null,
      durationMs: Date.now() - t0,
      ipAddress: ip,
      userAgent,
    });
    return NextResponse.json(
      {
        error: guardrails.reason ?? "denied",
        message: guardrails.userMessage ?? "Petición rechazada.",
        budget: guardrails.budget ?? null,
      },
      { status: guardrails.httpStatus ?? 403 },
    );
  }

  const admin = getSupabaseAdmin();
  let sessionId = parsed.data.sessionId ?? null;

  // ── 6. Resolver o crear sesión ─────────────────────────────────────────
  if (sessionId) {
    const { data: existing } = await admin
      .from("asistente_sessions")
      .select("id, tenant_id, user_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (
      !existing ||
      (existing as { tenant_id: string; user_id: string }).tenant_id !== tenantId ||
      (existing as { tenant_id: string; user_id: string }).user_id !== user.id
    ) {
      await logSecurityEvent({
        tenantId,
        userId: user.id,
        sessionId,
        eventType: "cross_tenant_attempt",
        severity: "error",
        payload: { reason: "session_mismatch" },
        ipAddress: ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "sesion_invalida", message: "La sesión no es válida." },
        { status: 403 },
      );
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createErr } = await (
      admin.from("asistente_sessions") as any
    )
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        title: parsed.data.message.slice(0, 60),
        status: "active",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createErr || !created) {
      console.error("[asistente.chat] session_create_failed", createErr);
      return NextResponse.json(
        {
          error: "session_create_failed",
          message: "No se pudo iniciar la conversación.",
        },
        { status: 500 },
      );
    }
    sessionId = (created as { id: string }).id;
  }

  // ── 7. Persistir mensaje del usuario ───────────────────────────────────
  const userMessageContent = guardrails.sanitized?.cleaned ?? parsed.data.message;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("asistente_messages") as any).insert({
    session_id: sessionId,
    tenant_id: tenantId,
    user_id: user.id,
    role: "user",
    content: userMessageContent,
  });

  // ── 8. Cargar historial previo (últimos N mensajes de la sesión) ───────
  const priorMessages = await loadPriorMessages(admin, sessionId!);

  // ── 9. Ejecutar turn del asistente ─────────────────────────────────────
  let turnResult: Awaited<ReturnType<typeof runAssistantTurn>>;
  try {
    turnResult = await runAssistantTurn({
      tenantId,
      tenantName,
      tenantTimezone,
      userId: user.id,
      userRole,
      autonomyMode: tenantCfg.asistente_autonomy_mode,
      sessionId: sessionId!,
      userMessage: userMessageContent,
      priorMessages,
      situationalSummary: null,
      ipAddress: ip,
      userAgent,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[asistente.chat] llm_turn_failed", errMsg);

    await logAudit({
      tenantId,
      userId: user.id,
      sessionId,
      actionType: "tool_call",
      toolName: "llm_turn",
      status: "error",
      reason: errMsg.slice(0, 500),
      durationMs: Date.now() - t0,
      ipAddress: ip,
      userAgent,
    });

    // Diferenciamos errores de configuración (api key) de errores transitorios.
    const isMissingKey =
      errMsg.includes("API_KEY") || errMsg.includes("no configurada");
    return NextResponse.json(
      {
        error: isMissingKey ? "llm_not_configured" : "llm_error",
        message: isMissingKey
          ? "El asistente no está configurado. Avisa al administrador."
          : "No he podido generar respuesta. Prueba otra vez en un momento.",
      },
      { status: isMissingKey ? 503 : 502 },
    );
  }

  // ── 10. Actualizar last_message_at de la sesión ────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("asistente_sessions") as any)
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

  // ── 11. Responder ──────────────────────────────────────────────────────
  return NextResponse.json({
    sessionId,
    reply: turnResult.reply,
    meta: {
      ...turnResult.meta,
      suspiciousPatterns: guardrails.sanitized?.suspiciousPatterns ?? [],
      truncated: guardrails.sanitized?.truncated ?? false,
      budget: guardrails.budget ?? null,
      durationMs: Date.now() - t0,
    },
  });
}

/**
 * Carga los últimos MAX_PRIOR_MESSAGES de una sesión y los convierte al
 * formato ModelMessage del AI SDK. Filtra mensajes sin contenido relevante
 * (los de role='tool' se omiten porque el LLM los va a reconstruir en el
 * próximo turn a través de las tools).
 */
async function loadPriorMessages(
  admin: ReturnType<typeof getSupabaseAdmin>,
  sessionId: string,
): Promise<ModelMessage[]> {
  const { data, error } = await admin
    .from("asistente_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(MAX_PRIOR_MESSAGES + 1); // +1 para descartar el que acabamos de insertar

  if (error || !data) return [];

  const rows =
    (data as Array<{ role: "user" | "assistant"; content: string | null }>) ??
    [];

  // Excluimos el último (que es el que acabamos de insertar) e invertimos.
  const history = rows.slice(1).reverse();

  const messages: ModelMessage[] = [];
  for (const r of history) {
    if (!r.content) continue;
    if (r.role === "user") {
      messages.push({ role: "user", content: r.content });
    } else {
      messages.push({ role: "assistant", content: r.content });
    }
  }
  return messages;
}
