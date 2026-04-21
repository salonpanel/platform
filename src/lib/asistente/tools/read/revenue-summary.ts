/**
 * Tool: get_revenue_summary
 *
 * Resumen de ingresos cobrados del tenant: hoy, últimos 7 días y mes en curso.
 * Usa la RPC asistente_revenue_summary que calcula en la zona horaria indicada.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({}).describe(
  "Sin parámetros. Siempre devuelve resumen de hoy, 7 días y mes en curso.",
);

interface RevenuePayload {
  today: { eur: string; cents: number; count: number };
  week: { eur: string; cents: number; count: number };
  month: { eur: string; cents: number; count: number };
}

export function buildGetRevenueSummaryTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Devuelve ingresos cobrados del negocio: hoy, últimos 7 días y mes en curso. Usa la zona horaria del negocio. Útil para '¿cómo va el día?', '¿cuánto hemos hecho esta semana?'.",
    inputSchema: InputSchema,
    execute: async (): Promise<ToolOutput<RevenuePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_revenue_summary",
          toolCategory: "READ_LOW",
          toolInput: null,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase.rpc as any)(
            "asistente_revenue_summary",
            {
              p_tenant_id: ctx.tenantId,
              p_tz: tenantTimezone || "Europe/Madrid",
            },
          );

          if (error) {
            return err("No se pudo calcular el resumen de ingresos.");
          }

          const row = Array.isArray(data)
            ? (data[0] as Record<string, number>)
            : (data as Record<string, number>);
          if (!row) {
            return err("Resumen vacío.");
          }

          const payload: RevenuePayload = {
            today: {
              eur: centsToEur(Number(row.today_cents ?? 0)),
              cents: Number(row.today_cents ?? 0),
              count: Number(row.today_count ?? 0),
            },
            week: {
              eur: centsToEur(Number(row.week_cents ?? 0)),
              cents: Number(row.week_cents ?? 0),
              count: Number(row.week_count ?? 0),
            },
            month: {
              eur: centsToEur(Number(row.month_cents ?? 0)),
              cents: Number(row.month_cents ?? 0),
              count: Number(row.month_count ?? 0),
            },
          };

          const summary = `Hoy ${payload.today.eur} (${payload.today.count} citas) · 7 días ${payload.week.eur} · mes ${payload.month.eur}.`;

          return ok<RevenuePayload>(summary, payload);
        },
      );
    },
  });
}
