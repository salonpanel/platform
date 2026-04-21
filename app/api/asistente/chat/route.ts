/**
 * POST /api/asistente/chat
 *
 * Endpoint del chat del asistente. En esta Fase 0 NO llama a ningún LLM:
 * solamente pasa el mensaje por toda la cadena de guardrails para verificar
 * que la infraestructura de seguridad funciona extremo a extremo, registra
 * un audit entry y devuelve una respuesta placeholder.
 *
 * Cuando conectemos el proveedor de LLM (Claude/OpenAI), el cambio será
 * reemplazar el bloque "placeholder response" por el loop de tool-use.
 *
 * Cadena de comprobaciones (en orden):
 *  1) Auth: supabase.auth.getUser()
 *  2) Membership al tenant
 *  3) Kill switch global + tenant (capability 'chat') vía runChatGuardrails
 *  4) Budget mensual
 *  5) Rate limits IP/user/tenant
 *  6) Sanitización + detección de jailbreak
 *  7) Persist session + message
 *  8) Audit entry
 *  9) Respuesta placeholder
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClientForServer } from "@/lib/supabase/server-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/rate-limit";
import {
  runChatGuardrails,
  logAudit,
  logSecurityEvent,
} from "@/lib/asistente/security";

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

  // ── 3. Resolver membership + rol ───────────────────────────────────────
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

  // ── 4. Verificar que el asistente está habilitado en el tenant ─────────
  const { data: tenantRow } = await supabaseAuth
    .from("tenants")
    .select("asistente_enabled, asistente_autonomy_mode")
    .eq("id", tenantId)
    .maybeSingle();

  const tenantCfg = tenantRow as TenantConfigRow | null;
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

  // ── 5. Guardrails (kill switch + budget + rate limit + sanitización) ──
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
      actionType:
        guardrails.reason?.startsWith("rate_limited")
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

  // ── 6. Resolver o crear la sesión ──────────────────────────────────────
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
    const { data: created, error: createErr } = await (admin.from("asistente_sessions") as any)
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

  // ── 8. PLACEHOLDER de respuesta del asistente ──────────────────────────
  // En fases posteriores: loop tool-use con Vercel AI SDK + Claude.
  // Aquí solo devolvemos un eco controlado para validar infra.
  const placeholderReply = buildPlaceholderReply({
    autonomy: tenantCfg.asistente_autonomy_mode,
    budgetPercent: guardrails.budget?.percentUsed ?? 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: aiMsg } = await (admin.from("asistente_messages") as any)
    .insert({
      session_id: sessionId,
      tenant_id: tenantId,
      user_id: null,
      role: "assistant",
      content: placeholderReply,
      model: "placeholder-v0",
      finish_reason: "placeholder",
    })
    .select("id")
    .single();

  // Actualizar last_message_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("asistente_sessions") as any)
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

  // ── 9. Audit entry ─────────────────────────────────────────────────────
  await logAudit({
    tenantId,
    userId: user.id,
    sessionId,
    messageId: (aiMsg as { id: string } | null)?.id ?? null,
    actionType: "tool_call",
    toolName: "placeholder_reply",
    toolCategory: "READ_LOW",
    toolInput: {
      suspicious: guardrails.sanitized?.suspiciousPatterns ?? [],
      truncated: guardrails.sanitized?.truncated ?? false,
    },
    status: "ok",
    durationMs: Date.now() - t0,
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({
    sessionId,
    reply: placeholderReply,
    meta: {
      model: "placeholder-v0",
      autonomy: tenantCfg.asistente_autonomy_mode,
      suspiciousPatterns: guardrails.sanitized?.suspiciousPatterns ?? [],
      truncated: guardrails.sanitized?.truncated ?? false,
      budget: guardrails.budget ?? null,
      durationMs: Date.now() - t0,
    },
  });
}

function buildPlaceholderReply(opts: {
  autonomy: "supervised" | "semi" | "autonomous";
  budgetPercent: number;
}): string {
  const autonomyLabel = {
    supervised: "supervisado",
    semi: "semi-autónomo",
    autonomous: "autónomo",
  }[opts.autonomy];

  return [
    "🔒 BookFast AI — Fase 0 (infraestructura de seguridad).",
    "",
    "Tu mensaje ha pasado todos los guardrails: kill switch, budget, rate limit, sanitización.",
    `Modo de autonomía actual: ${autonomyLabel}.`,
    `Uso de budget este mes: ${opts.budgetPercent.toFixed(1)}%.`,
    "",
    "El modelo de IA todavía no está conectado. Muy pronto.",
  ].join("\n");
}
