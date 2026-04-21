/**
 * Cliente principal del asistente: orquesta el tool-use loop con el LLM.
 *
 * API única: runAssistantTurn() recibe el mensaje del usuario y devuelve
 * la respuesta final del asistente. Por dentro:
 *
 *  1. Construye system prompt con contexto situacional.
 *  2. Carga el registro de tools con bindings al tenant/user actual.
 *  3. Ejecuta generateText con stopWhen=stepCountIs(MAX_STEPS).
 *  4. Por cada paso (texto + tool-calls + tool-results), persiste filas en
 *     asistente_messages.
 *  5. Suma tokens de todos los pasos y calcula coste total.
 *  6. Incrementa uso mensual del tenant.
 *  7. Devuelve reply final y metadatos.
 *
 * No devuelve streaming. Para streaming se hará un wrapper encima con
 * streamText + Server-Sent Events (fase posterior).
 */

import { generateText, stepCountIs, type ModelMessage } from "ai";
import { resolveLlmConfig, computeCostCents } from "./providers";
import { buildSystemPrompt, SYSTEM_PROMPT_VERSION } from "./system-prompt";
import { buildToolSet, type ToolRuntimeContext } from "../tools/registry";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "../security/audit";
import type { TenantRole } from "../security/types";

/** Límite de pasos del tool-use loop. Previene bucles infinitos. */
const MAX_STEPS = 6;

export interface RunAssistantTurnInput {
  tenantId: string;
  tenantName: string;
  tenantTimezone: string;
  userId: string;
  userRole: TenantRole;
  autonomyMode: "supervised" | "semi" | "autonomous";
  sessionId: string;
  /** Mensaje del usuario YA sanitizado por guardrails. */
  userMessage: string;
  /** Historial previo a incluir (mensajes anteriores de la sesión). */
  priorMessages: ModelMessage[];
  /** Resumen situacional opcional — hechos del día inyectados en el system prompt. */
  situationalSummary?: string | null;
  /** Para audit (IP, user agent). */
  ipAddress: string | null;
  userAgent: string | null;
}

export interface RunAssistantTurnOutput {
  /** Texto final que se muestra al usuario. */
  reply: string;
  /** ID del mensaje assistant persistido (el "último"). */
  assistantMessageId: string;
  /** Metadata para el front. */
  meta: {
    provider: string;
    model: string;
    stepCount: number;
    toolsCalled: string[];
    tokensInput: number;
    tokensOutput: number;
    costCents: number;
    finishReason: string;
    durationMs: number;
  };
}

export async function runAssistantTurn(
  input: RunAssistantTurnInput,
): Promise<RunAssistantTurnOutput> {
  const t0 = Date.now();
  const cfg = resolveLlmConfig();

  const systemPrompt = buildSystemPrompt({
    tenantName: input.tenantName,
    tenantTimezone: input.tenantTimezone,
    userRole: input.userRole,
    autonomyMode: input.autonomyMode,
    nowIso: new Date().toISOString(),
    situationalSummary: input.situationalSummary ?? null,
  });

  const toolContext: ToolRuntimeContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    userRole: input.userRole,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };
  const tools = buildToolSet(toolContext, {
    tenantTimezone: input.tenantTimezone,
  });

  const messages: ModelMessage[] = [
    ...input.priorMessages,
    { role: "user", content: input.userMessage },
  ];

  // ── Llamada al LLM con loop de tool-use ────────────────────────────────
  const result = await generateText({
    model: cfg.model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    // Temperatura baja-media: queremos consistencia pero no robotizado.
    temperature: 0.3,
  });

  const durationMs = Date.now() - t0;
  const admin = getSupabaseAdmin();

  // Agregamos tokens de todos los pasos.
  let totalInput = 0;
  let totalOutput = 0;
  const toolsCalledAll: string[] = [];
  const steps = result.steps ?? [];

  for (const step of steps) {
    totalInput += step.usage?.inputTokens ?? 0;
    totalOutput += step.usage?.outputTokens ?? 0;
    for (const tc of step.toolCalls ?? []) {
      toolsCalledAll.push(tc.toolName);
    }
  }

  const costCents = computeCostCents({
    pricing: cfg.pricing,
    tokensInput: totalInput,
    tokensOutput: totalOutput,
  });

  // ── Persistir cada paso en asistente_messages ──────────────────────────
  // Estructura: por cada step con toolCalls, guardamos una fila por tool call
  // (role='tool') y luego una fila del assistant con el texto final. Esto nos
  // permite auditar paso a paso y reconstruir la conversación en UI.
  let lastAssistantMessageId: string | null = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    // Tool calls → una fila por cada invocación
    for (const tc of step.toolCalls ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("asistente_messages") as any).insert({
        session_id: input.sessionId,
        tenant_id: input.tenantId,
        user_id: null,
        role: "tool",
        content: null,
        tool_name: tc.toolName,
        tool_input: tc.input ?? null,
        tool_output: null,
        step_index: i,
        provider: cfg.provider,
        model: cfg.modelId,
      });
    }
    // Tool results → los añadimos al mismo step (linked) como tool-output
    for (const tr of step.toolResults ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("asistente_messages") as any).insert({
        session_id: input.sessionId,
        tenant_id: input.tenantId,
        user_id: null,
        role: "tool",
        content: null,
        tool_name: tr.toolName,
        tool_input: null,
        tool_output: (tr as { output?: unknown }).output ?? null,
        step_index: i,
        provider: cfg.provider,
        model: cfg.modelId,
      });
    }
    // Si hay texto en este step (final o intermedio), lo guardamos
    const stepText = step.text?.trim();
    if (stepText) {
      const isLast = i === steps.length - 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (admin.from("asistente_messages") as any)
        .insert({
          session_id: input.sessionId,
          tenant_id: input.tenantId,
          user_id: null,
          role: "assistant",
          content: stepText,
          step_index: i,
          provider: cfg.provider,
          model: cfg.modelId,
          finish_reason: isLast ? result.finishReason : "continue",
          tokens_input: step.usage?.inputTokens ?? null,
          tokens_output: step.usage?.outputTokens ?? null,
          tools_called:
            (step.toolCalls ?? []).map((t) => t.toolName) || null,
          cost_cents: isLast ? costCents : null,
        })
        .select("id")
        .single();
      lastAssistantMessageId = (data as { id: string } | null)?.id ?? null;
    }
  }

  // Fallback: si por lo que sea no se creó ningún mensaje assistant
  // (stream que solo devolvió text sin steps), guardamos uno mínimo.
  if (!lastAssistantMessageId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from("asistente_messages") as any)
      .insert({
        session_id: input.sessionId,
        tenant_id: input.tenantId,
        user_id: null,
        role: "assistant",
        content: result.text,
        step_index: 0,
        provider: cfg.provider,
        model: cfg.modelId,
        finish_reason: result.finishReason,
        tokens_input: totalInput,
        tokens_output: totalOutput,
        cost_cents: costCents,
      })
      .select("id")
      .single();
    lastAssistantMessageId = (data as { id: string } | null)?.id ?? null;
  }

  // ── Incrementar uso mensual ────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)("asistente_increment_usage", {
      p_tenant_id: input.tenantId,
      p_tokens_input: totalInput,
      p_tokens_output: totalOutput,
      p_cost_cents: costCents,
      p_tool_calls: toolsCalledAll.length,
    });
  } catch (err) {
    console.error("[asistente.llm] increment_usage_failed", err);
  }

  // ── Audit del turn completo ────────────────────────────────────────────
  await logAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionId,
    messageId: lastAssistantMessageId,
    actionType: "tool_call",
    toolName: "llm_turn",
    toolCategory: "READ_LOW",
    toolInput: {
      provider: cfg.provider,
      model: cfg.modelId,
      systemPromptVersion: SYSTEM_PROMPT_VERSION,
      toolsCalled: toolsCalledAll,
      stepCount: steps.length,
    },
    toolOutputSummary: {
      tokensInput: totalInput,
      tokensOutput: totalOutput,
      costCents,
      finishReason: result.finishReason,
    },
    status: "ok",
    durationMs,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    reply: result.text,
    assistantMessageId: lastAssistantMessageId ?? "",
    meta: {
      provider: cfg.provider,
      model: cfg.modelId,
      stepCount: steps.length,
      toolsCalled: toolsCalledAll,
      tokensInput: totalInput,
      tokensOutput: totalOutput,
      costCents,
      finishReason: result.finishReason,
      durationMs,
    },
  };
}
