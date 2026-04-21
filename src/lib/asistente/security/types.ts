/**
 * Types compartidos del módulo de seguridad del asistente.
 *
 * Mantener este archivo pequeño y sin dependencias para poder importarlo
 * tanto desde server como desde edge/middleware si hace falta.
 */

export type ToolCategory =
  | "READ_LOW"
  | "READ_HIGH"
  | "WRITE_LOW"
  | "WRITE_HIGH"
  | "CRITICAL";

export type TenantRole = "owner" | "admin" | "manager" | "staff";

export type SecurityEventType =
  | "jailbreak_detected"
  | "rate_limit_exceeded"
  | "budget_exceeded"
  | "killswitch_hit"
  | "cross_tenant_attempt"
  | "pii_redacted"
  | "tool_schema_violation"
  | "suspicious_pattern"
  | "confirmation_required";

export type SecuritySeverity = "info" | "warn" | "error" | "critical";

export type AuditActionType =
  | "tool_call"
  | "tool_denied"
  | "rate_limited"
  | "budget_blocked"
  | "killswitch_blocked"
  | "bulk_snapshot"
  | "confirmation_required"
  | "confirmation_granted";

export type AuditStatus = "ok" | "denied" | "error" | "pending_confirmation";

export interface GuardrailContext {
  tenantId: string;
  userId: string;
  userRole: TenantRole | null;
  sessionId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  httpStatus?: number;
  severity?: SecuritySeverity;
  eventType?: SecurityEventType;
}
