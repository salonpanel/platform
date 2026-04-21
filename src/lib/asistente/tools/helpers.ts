/**
 * Helpers compartidos para las tools del asistente.
 *
 * - formatEur: formato "15,50 €"
 * - formatDate / formatTime: formato humano en la zona del tenant
 * - toHumanList: convierte array → "A, B y C"
 * - wrap: envuelve tool outputs en la forma estándar que el LLM entiende.
 * - withAudit: runner genérico que añade audit entry tras ejecutar.
 */

import { formatInTimeZone } from "date-fns-tz";
import { logAudit } from "../security/audit";
import type { AuditStatus, ToolCategory } from "../security/types";

export function centsToEur(cents: number | null | undefined): string {
  const c = cents ?? 0;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(c / 100);
}

export function formatEur(value: number | null | undefined, decimals = 2): string {
  const v = value ?? 0;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

export function formatTime(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "HH:mm");
}

export function formatDate(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd");
}

export function formatDateHuman(iso: string, timezone: string): string {
  return formatInTimeZone(new Date(iso), timezone, "EEEE d 'de' MMMM, HH:mm");
}

export function toHumanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Normaliza el output de una tool. El LLM siempre recibe un objeto con:
 *  { ok: boolean, data?: T, summary?: string, error?: string, hint?: string }
 *
 * - summary: una frase en español pensada para que el LLM pueda citarla
 *   directamente al usuario sin tener que reprocesar todo el payload.
 * - data: payload estructurado por si quiere profundizar.
 * - error/hint: cuando algo falla, explicamos qué y sugerimos cómo recuperarse.
 */
export interface ToolOutputOk<T> {
  ok: true;
  summary: string;
  data: T;
}
export interface ToolOutputErr {
  ok: false;
  error: string;
  hint?: string;
}
export type ToolOutput<T> = ToolOutputOk<T> | ToolOutputErr;

export function ok<T>(summary: string, data: T): ToolOutputOk<T> {
  return { ok: true, summary, data };
}
export function err(error: string, hint?: string): ToolOutputErr {
  return { ok: false, error, hint };
}

/**
 * Envuelve la ejecución de una tool con audit automático.
 * No convierte excepciones en errores del asistente: las propaga para que
 * el framework las registre como tool failure.
 */
export async function withAudit<T>(
  params: {
    tenantId: string;
    userId: string;
    sessionId: string;
    toolName: string;
    toolCategory: ToolCategory;
    toolInput: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
  },
  fn: () => Promise<ToolOutput<T>>,
): Promise<ToolOutput<T>> {
  const t0 = Date.now();
  let status: AuditStatus = "ok";
  let reason: string | null = null;
  let result: ToolOutput<T> | null = null;
  try {
    result = await fn();
    if (!result.ok) {
      status = "denied";
      reason = result.error;
    }
    return result;
  } catch (e) {
    status = "error";
    reason = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await logAudit({
      tenantId: params.tenantId,
      userId: params.userId,
      sessionId: params.sessionId,
      actionType: status === "ok" ? "tool_call" : "tool_denied",
      toolName: params.toolName,
      toolCategory: params.toolCategory,
      toolInput: params.toolInput,
      toolOutputSummary:
        result && result.ok
          ? { summary: result.summary }
          : result
            ? { error: result.error }
            : null,
      status,
      reason,
      durationMs: Date.now() - t0,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }
}
