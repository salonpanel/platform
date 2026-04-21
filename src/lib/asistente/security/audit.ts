/**
 * Audit log y security events.
 *
 * Dos funciones principales:
 *  - logAudit() → registra cada tool call / decisión de guardrail.
 *  - logSecurityEvent() → registra eventos sospechosos (jailbreak, rate
 *    limit, cross-tenant, etc.).
 *
 * Todas las inserciones van por service_role (admin client) porque las
 * tablas no tienen policy de INSERT para auth.uid() → son append-only
 * gestionadas por el backend.
 *
 * Ambas funciones son no-throwing: si la inserción falla, se loguea en
 * consola pero NO se propaga el error al caller. El audit log es
 * observability, no gating; si no se puede loguear, la operación sigue
 * (aunque se emite un error grave para alertar).
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AuditActionType,
  AuditStatus,
  SecurityEventType,
  SecuritySeverity,
  ToolCategory,
} from "./types";
import { redactPii } from "./sanitize";

interface LogAuditInput {
  tenantId: string;
  userId: string | null;
  sessionId: string | null;
  messageId?: string | null;
  actionType: AuditActionType;
  toolName?: string | null;
  toolCategory?: ToolCategory | null;
  toolInput?: Record<string, unknown> | null;
  toolOutputSummary?: Record<string, unknown> | null;
  affectedEntityType?: string | null;
  affectedEntityIds?: string[] | null;
  status: AuditStatus;
  reason?: string | null;
  durationMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Redacta un objeto para logging: PII evidente se reemplaza.
 */
function redactForLog(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string") {
      out[k] = redactPii(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === "string" ? redactPii(item) : item,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const payload = {
      tenant_id: input.tenantId,
      user_id: input.userId,
      session_id: input.sessionId,
      message_id: input.messageId ?? null,
      action_type: input.actionType,
      tool_name: input.toolName ?? null,
      tool_category: input.toolCategory ?? null,
      tool_input: redactForLog(input.toolInput ?? null),
      tool_output_summary: input.toolOutputSummary ?? null,
      affected_entity_type: input.affectedEntityType ?? null,
      affected_entity_ids: input.affectedEntityIds ?? null,
      status: input.status,
      reason: input.reason ?? null,
      duration_ms: input.durationMs ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("asistente_audit_log") as any).insert(payload);
    if (error) {
      console.error("[asistente.audit] insert_failed", error);
    }
  } catch (err) {
    console.error("[asistente.audit] unexpected_error", err);
  }
}

interface LogSecurityEventInput {
  tenantId: string | null;
  userId: string | null;
  sessionId: string | null;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  payload?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logSecurityEvent(input: LogSecurityEventInput): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const row = {
      tenant_id: input.tenantId,
      user_id: input.userId,
      session_id: input.sessionId,
      event_type: input.eventType,
      severity: input.severity,
      payload: redactForLog(input.payload ?? null),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("asistente_security_events") as any).insert(row);
    if (error) {
      console.error("[asistente.security_event] insert_failed", error);
    }

    // En eventos críticos, log loud para que se vea en consola también.
    if (input.severity === "critical" || input.severity === "error") {
      console.warn(
        `[asistente.security_event] severity=${input.severity} type=${input.eventType} tenant=${input.tenantId} user=${input.userId}`,
      );
    }
  } catch (err) {
    console.error("[asistente.security_event] unexpected_error", err);
  }
}
