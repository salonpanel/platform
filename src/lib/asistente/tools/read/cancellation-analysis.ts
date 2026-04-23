/**
 * Tool: get_cancellation_analysis
 *
 * Cuenta citas pasadas a cancelado en una ventana reciente (filtrado por
 * updated_at). Incluye muestra con nombres para contexto.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  formatDateHuman,
  ok,
  err,
  withAudit,
  toHumanList,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Ventana hacia atrás desde ahora (días)."),
  sampleLimit: z.number().int().min(1).max(15).default(8),
});

interface SampleRow {
  whenHuman: string;
  customerName: string;
  /** Inicio programado de la cita (cuando aún existía). */
  startHuman: string;
}

interface Payload {
  days: number;
  cancelledCount: number;
  sinceIso: string;
  samples: SampleRow[];
}

export function buildGetCancellationAnalysisTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Analiza cancelaciones recientes: cuántas citas quedaron en estado cancelado cuya última actualización cae en la ventana (aproxima el momento en que se canceló o sincronizó). Útil para '¿cuánto estamos cancelando últimamente?'. Devuelve también una muestra con nombres.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_cancellation_analysis",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const sinceIso = new Date(
            Date.now() - input.days * 24 * 3600 * 1000,
          ).toISOString();
          const supabase = getSupabaseAdmin();

          const { count, error: cErr } = await (supabase.from("bookings") as any)
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", ctx.tenantId)
            .gte("updated_at", sinceIso)
            .or("booking_state.eq.cancelled,status.eq.cancelled");

          if (cErr) {
            return err("No se pudo contar cancelaciones.");
          }

          const cancelledCount = count ?? 0;

          const { data: rows, error: sErr } = await (supabase.from("bookings") as any)
            .select(
              "starts_at, updated_at, customer:customers(name, full_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .gte("updated_at", sinceIso)
            .or("booking_state.eq.cancelled,status.eq.cancelled")
            .order("updated_at", { ascending: false })
            .limit(input.sampleLimit);

          if (sErr) {
            return err("No se pudo cargar el detalle de cancelaciones.");
          }

          const raw =
            (rows as unknown as Array<{
              starts_at: string;
              updated_at: string;
              customer: { name: string | null; full_name: string | null } | null;
            }>) ?? [];

          const samples: SampleRow[] = raw.map((r) => {
            const cn =
              r.customer?.full_name ?? r.customer?.name ?? "Cliente";
            return {
              customerName: cn,
              whenHuman: formatDateHuman(r.updated_at, tenantTimezone),
              startHuman: formatDateHuman(r.starts_at, tenantTimezone),
            };
          });

          const names = samples.slice(0, 3).map((s) => s.customerName);
          const summary =
            cancelledCount === 0
              ? `Ninguna cancelación registrada en la ventana de **${input.days}** días (por actualización).`
              : `**${cancelledCount}** cancelación(es) en los últimos **${input.days}** días (última actividad en el registro).` +
                (names.length
                  ? ` Ejemplos: ${toHumanList(names)}.`
                  : "");

          return ok<Payload>(summary, {
            days: input.days,
            cancelledCount,
            sinceIso,
            samples,
          });
        },
      );
    },
  });
}
