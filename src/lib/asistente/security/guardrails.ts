/**
 * Orquestador de guardrails para un turno de chat.
 *
 * Encapsula toda la cadena de comprobaciones que debe pasar CADA request
 * al endpoint /api/asistente/chat ANTES de llamar al LLM:
 *
 *   1) Kill switch global + tenant (capability 'chat').
 *   2) Budget mensual del tenant (<100%).
 *   3) Rate limits encadenados (IP → user → user_hour → tenant).
 *   4) Sanitización del input + detección de patrones sospechosos.
 *
 * Cualquier fallo se traduce en:
 *   - Response estructurada { allowed: false, httpStatus, reason }.
 *   - Security event persistido.
 *   - (Caller decide qué audit entry crear).
 *
 * El caller debe haber verificado YA:
 *   - Autenticación (Supabase user).
 *   - Membership al tenant.
 *   - Rol (p.ej. staff como mínimo).
 */

import { checkKillSwitch } from "./kill-switch";
import { getBudgetStatus } from "./budget";
import { checkChatRateLimits, isRateLimitAvailable } from "./rate-limit";
import { sanitizeUserMessage, type SanitizeResult } from "./sanitize";
import { logSecurityEvent } from "./audit";
import type { GuardrailContext } from "./types";

export interface ChatGuardrailsInput extends GuardrailContext {
  message: string;
  // En entornos de dev sin Upstash, permitimos pasar sin rate limit. En prod
  // (NODE_ENV=production) sin Upstash → bloqueamos (fail-safe).
  enforceRateLimit?: boolean;
}

export interface ChatGuardrailsOutput {
  allowed: boolean;
  httpStatus?: number;
  reason?: string;
  userMessage?: string;              // string user-friendly para devolver al cliente
  sanitized?: SanitizeResult;        // presente si allowed=true
  budget?: {
    usedCents: number;
    capCents: number;
    percentUsed: number;
  };
}

const DENIED_GENERIC = "No podemos procesar tu petición ahora mismo.";

export async function runChatGuardrails(
  input: ChatGuardrailsInput,
): Promise<ChatGuardrailsOutput> {
  const { tenantId, userId, sessionId, ipAddress, userAgent } = input;
  const enforce = input.enforceRateLimit ?? process.env.NODE_ENV === "production";

  // 1. Kill switch --------------------------------------------------------
  const killSwitch = await checkKillSwitch({ tenantId, capability: "chat" });
  if (!killSwitch.allowed) {
    await logSecurityEvent({
      tenantId,
      userId,
      sessionId,
      eventType: "killswitch_hit",
      severity: "warn",
      payload: { reason: killSwitch.reason, scope: killSwitch.scope },
      ipAddress,
      userAgent,
    });
    return {
      allowed: false,
      httpStatus: 503,
      reason: killSwitch.reason ?? "kill_switch_active",
      userMessage:
        killSwitch.scope === "global"
          ? "El asistente está temporalmente deshabilitado. Vuelve a intentarlo más tarde."
          : "El asistente está deshabilitado para este negocio. Contacta con el responsable.",
    };
  }

  // 2. Budget -------------------------------------------------------------
  const budget = await getBudgetStatus(tenantId);
  if (!budget.allowed) {
    await logSecurityEvent({
      tenantId,
      userId,
      sessionId,
      eventType: "budget_exceeded",
      severity: "warn",
      payload: {
        usedCents: budget.usedCents,
        capCents: budget.capCents,
        percent: budget.percentUsed,
      },
      ipAddress,
      userAgent,
    });
    return {
      allowed: false,
      httpStatus: 402,
      reason: budget.reason ?? "budget_exceeded",
      userMessage:
        "Has alcanzado el límite mensual del asistente. Configúralo desde Ajustes → IA.",
      budget: {
        usedCents: budget.usedCents,
        capCents: budget.capCents,
        percentUsed: budget.percentUsed,
      },
    };
  }

  // 3. Rate limits --------------------------------------------------------
  if (enforce && !isRateLimitAvailable()) {
    // Prod sin Upstash → fallo crítico.
    await logSecurityEvent({
      tenantId,
      userId,
      sessionId,
      eventType: "rate_limit_exceeded",
      severity: "critical",
      payload: { reason: "rate_limit_infra_unavailable" },
      ipAddress,
      userAgent,
    });
    return {
      allowed: false,
      httpStatus: 503,
      reason: "rate_limit_infra_unavailable",
      userMessage: DENIED_GENERIC,
    };
  }

  if (isRateLimitAvailable()) {
    const rl = await checkChatRateLimits({
      ip: ipAddress ?? "unknown",
      userId,
      tenantId,
    });
    if (!rl.allowed) {
      await logSecurityEvent({
        tenantId,
        userId,
        sessionId,
        eventType: "rate_limit_exceeded",
        severity: "warn",
        payload: { bucket: rl.reason },
        ipAddress,
        userAgent,
      });
      return {
        allowed: false,
        httpStatus: 429,
        reason: `rate_limited:${rl.reason}`,
        userMessage:
          "Demasiadas peticiones en poco tiempo. Espera un momento y vuelve a intentarlo.",
      };
    }
  }

  // 4. Sanitización + jailbreak detection ---------------------------------
  const sanitized = sanitizeUserMessage(input.message);
  if (sanitized.rejected) {
    await logSecurityEvent({
      tenantId,
      userId,
      sessionId,
      eventType: "suspicious_pattern",
      severity: "info",
      payload: { reason: sanitized.rejectionReason },
      ipAddress,
      userAgent,
    });
    return {
      allowed: false,
      httpStatus: 400,
      reason: sanitized.rejectionReason ?? "message_rejected",
      userMessage: "Tu mensaje es demasiado largo. Abrévialo e inténtalo de nuevo.",
    };
  }

  if (sanitized.suspiciousPatterns.length > 0) {
    // No bloqueamos, solo registramos. La defensa real está en el system prompt.
    await logSecurityEvent({
      tenantId,
      userId,
      sessionId,
      eventType: "jailbreak_detected",
      severity: "warn",
      payload: { patterns: sanitized.suspiciousPatterns },
      ipAddress,
      userAgent,
    });
  }

  return {
    allowed: true,
    sanitized,
    budget: {
      usedCents: budget.usedCents,
      capCents: budget.capCents,
      percentUsed: budget.percentUsed,
    },
  };
}
