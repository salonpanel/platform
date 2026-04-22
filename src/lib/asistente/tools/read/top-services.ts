/**
 * Tool: get_top_services
 *
 * Ranking de servicios por ingresos o nº de reservas en un periodo.
 * Solo cuenta reservas con status in (confirmed, completed) y paid.
 * Para totales globales hacemos la agregación en cliente (simple, volúmenes
 * típicos de un salón son pequeños).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Periodo hacia atrás en días. Por defecto 30."),
  orderBy: z
    .enum(["revenue", "bookings"])
    .default("revenue")
    .describe("'revenue' = ingresos, 'bookings' = nº reservas."),
  limit: z.number().int().min(1).max(25).default(10),
  onlyPaid: z.boolean().default(true),
});

interface TopServiceItem {
  serviceId: string;
  serviceName: string;
  bookings: number;
  revenueEur: string;
  revenueCents: number;
  avgEur: string;
}

interface TopServicesPayload {
  days: number;
  orderBy: string;
  count: number;
  items: TopServiceItem[];
}

export function buildGetTopServicesTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Ranking de servicios del negocio por ingresos o número de reservas en un periodo (por defecto 30 días). Útil para '¿qué servicio genera más?', '¿qué es lo más reservado este mes?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<TopServicesPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_top_services",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const sinceIso = new Date(
            Date.now() - input.days * 24 * 3600 * 1000,
          ).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("bookings")
            .select("service_id, price_cents, service:services(name)")
            .eq("tenant_id", ctx.tenantId)
            .in("status", ["confirmed", "completed"])
            .gte("starts_at", sinceIso)
            .not("service_id", "is", null);

          if (input.onlyPaid) query = query.eq("payment_status", "paid");

          const { data, error } = await query;
          if (error) return err("No se pudo calcular el ranking de servicios.");

          const rows =
            ((data as unknown) as Array<{
              service_id: string;
              price_cents: number | null;
              service: { name: string | null } | null;
            }>) ?? [];

          const agg = new Map<
            string,
            { name: string; count: number; cents: number }
          >();
          for (const r of rows) {
            const existing = agg.get(r.service_id) ?? {
              name: r.service?.name ?? "(sin nombre)",
              count: 0,
              cents: 0,
            };
            existing.count += 1;
            existing.cents += r.price_cents ?? 0;
            agg.set(r.service_id, existing);
          }

          const items: TopServiceItem[] = Array.from(agg.entries()).map(
            ([serviceId, v]) => ({
              serviceId,
              serviceName: v.name,
              bookings: v.count,
              revenueEur: centsToEur(v.cents),
              revenueCents: v.cents,
              avgEur: centsToEur(v.count > 0 ? Math.round(v.cents / v.count) : 0),
            }),
          );

          items.sort((a, b) =>
            input.orderBy === "revenue"
              ? b.revenueCents - a.revenueCents
              : b.bookings - a.bookings,
          );

          const truncated = items.slice(0, input.limit);

          const summary =
            truncated.length === 0
              ? `Sin actividad de servicios en los últimos ${input.days} días.`
              : `Top ${truncated.length} servicios por ${input.orderBy === "revenue" ? "ingresos" : "reservas"} (últimos ${input.days} días).`;

          return ok<TopServicesPayload>(summary, {
            days: input.days,
            orderBy: input.orderBy,
            count: truncated.length,
            items: truncated,
          });
        },
      );
    },
  });
}
