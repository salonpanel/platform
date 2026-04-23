/**
 * Tool: get_customer_insights
 *
 * Métricas de retención de un cliente: cuánto tiempo lleva sin venir,
 * frecuencia media entre visitas, ticket medio, servicio y profesional
 * favoritos. Útil para "¿cómo de fiel es Laura?" o para decidir si
 * incluirla en una campaña.
 *
 * Se apoya en las columnas pre-agregadas (visits_count, total_spent_cents,
 * last_booking_at) y en un análisis ligero de sus últimas citas para
 * sacar favoritos.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  centsToEur,
  formatDateHuman,
  ok,
  err,
  withAudit,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  customerId: z.string().uuid(),
  lookbackLimit: z
    .number()
    .int()
    .min(3)
    .max(50)
    .default(20)
    .describe("Cuántas reservas históricas analizar para sacar favoritos."),
});

interface InsightsPayload {
  customerId: string;
  customerName: string | null;
  visits: number;
  totalSpentEur: string;
  avgTicketEur: string;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  daysSinceLastVisit: number | null;
  avgDaysBetweenVisits: number | null;
  favoriteService: { id: string; name: string; count: number } | null;
  favoriteStaff: { id: string; name: string; count: number } | null;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  retentionLabel: string; // 'activo' | 'enfriándose' | 'dormido' | 'perdido' | 'nuevo'
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function retentionLabelFor(
  visits: number,
  daysSinceLast: number | null,
): string {
  if (visits === 0) return "sin visitas";
  if (visits <= 1) return "nuevo";
  if (daysSinceLast == null) return "indeterminado";
  if (daysSinceLast <= 45) return "activo";
  if (daysSinceLast <= 90) return "enfriándose";
  if (daysSinceLast <= 180) return "dormido";
  return "perdido";
}

export function buildGetCustomerInsightsTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Métricas de retención de un cliente: días desde la última visita, ticket medio, frecuencia entre visitas, servicio/staff favorito y label de estado (activo, enfriándose, dormido, perdido). Úsala antes de proponer una reactivación o para entender el comportamiento del cliente.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<InsightsPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_customer_insights",
          toolCategory: "READ_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const { data: cust } = await supabase
            .from("customers")
            .select(
              "id, name, full_name, visits_count, no_show_count, total_spent_cents, last_booking_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.customerId)
            .maybeSingle();

          const c = cust as {
            id: string;
            name: string | null;
            full_name: string | null;
            visits_count: number | null;
            no_show_count: number | null;
            total_spent_cents: number | null;
            last_booking_at: string | null;
          } | null;

          if (!c) return err("Cliente no encontrado.");

          // Histórico reciente para favoritos y distribución de estados.
          const { data: history } = await supabase
            .from("bookings")
            .select(
              "starts_at, status, service_id, staff_id, service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("customer_id", input.customerId)
            .order("starts_at", { ascending: false })
            .limit(input.lookbackLimit);

          const rows =
            (history as unknown as Array<{
              starts_at: string;
              status: string;
              service_id: string | null;
              staff_id: string | null;
              service: { name: string | null } | null;
              staff: { name: string | null; display_name: string | null } | null;
            }>) ?? [];

          // Frecuencia entre visitas completadas.
          const completedDates = rows
            .filter((r) => r.status === "completed")
            .map((r) => new Date(r.starts_at).getTime())
            .sort((a, b) => a - b);
          let avgDaysBetweenVisits: number | null = null;
          if (completedDates.length >= 2) {
            const gaps: number[] = [];
            for (let i = 1; i < completedDates.length; i += 1) {
              gaps.push(
                (completedDates[i] - completedDates[i - 1]) /
                  (1000 * 60 * 60 * 24),
              );
            }
            avgDaysBetweenVisits = Math.round(
              gaps.reduce((a, b) => a + b, 0) / gaps.length,
            );
          }

          // Favoritos por conteo.
          const svcCount = new Map<string, { name: string; count: number }>();
          const stfCount = new Map<string, { name: string; count: number }>();
          let completedCount = 0;
          let cancelledCount = 0;
          let noShowCount = 0;

          for (const r of rows) {
            if (r.status === "completed") completedCount += 1;
            if (r.status === "cancelled") cancelledCount += 1;
            if (r.status === "no_show") noShowCount += 1;

            if (r.service_id && r.service?.name) {
              const cur = svcCount.get(r.service_id);
              svcCount.set(r.service_id, {
                name: r.service.name,
                count: (cur?.count ?? 0) + 1,
              });
            }
            if (r.staff_id) {
              const stfName =
                r.staff?.display_name ?? r.staff?.name ?? null;
              if (stfName) {
                const cur = stfCount.get(r.staff_id);
                stfCount.set(r.staff_id, {
                  name: stfName,
                  count: (cur?.count ?? 0) + 1,
                });
              }
            }
          }

          const topEntry = <V extends { count: number }>(
            m: Map<string, V>,
          ): [string, V] | null => {
            let best: [string, V] | null = null;
            for (const [k, v] of m) {
              if (!best || v.count > best[1].count) best = [k, v];
            }
            return best;
          };
          const svcTop = topEntry(svcCount);
          const stfTop = topEntry(stfCount);

          const visits = c.visits_count ?? 0;
          const totalCents = c.total_spent_cents ?? 0;
          const avgTicketCents =
            visits > 0 ? Math.round(totalCents / visits) : 0;

          const firstBookingAt =
            completedDates.length > 0
              ? new Date(completedDates[0]).toISOString()
              : null;

          const daysSinceLast = daysSince(c.last_booking_at);

          const payload: InsightsPayload = {
            customerId: c.id,
            customerName: c.full_name ?? c.name ?? null,
            visits,
            totalSpentEur: centsToEur(totalCents),
            avgTicketEur: centsToEur(avgTicketCents),
            firstBookingAt,
            lastBookingAt: c.last_booking_at,
            daysSinceLastVisit: daysSinceLast,
            avgDaysBetweenVisits,
            favoriteService: svcTop
              ? { id: svcTop[0], name: svcTop[1].name, count: svcTop[1].count }
              : null,
            favoriteStaff: stfTop
              ? { id: stfTop[0], name: stfTop[1].name, count: stfTop[1].count }
              : null,
            completedCount,
            cancelledCount,
            noShowCount: c.no_show_count ?? noShowCount,
            retentionLabel: retentionLabelFor(visits, daysSinceLast),
          };

          const parts: string[] = [];
          parts.push(
            `${payload.customerName ?? "Cliente"} — ${visits} visita(s), ticket medio ${payload.avgTicketEur}`,
          );
          if (daysSinceLast != null) parts.push(`última hace ${daysSinceLast}d`);
          if (avgDaysBetweenVisits)
            parts.push(`cada ~${avgDaysBetweenVisits}d`);
          if (payload.favoriteService)
            parts.push(`prefiere ${payload.favoriteService.name}`);
          parts.push(payload.retentionLabel);

          return ok<InsightsPayload>(parts.join(" · ") + ".", payload);
        },
      );
    },
  });
}
