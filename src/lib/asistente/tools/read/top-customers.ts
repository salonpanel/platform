/**
 * Tool: get_top_customers
 *
 * Ranking de mejores clientes por gasto total, visitas o no-shows.
 * Usa las columnas pre-agregadas de `customers` (total_spent_cents,
 * visits_count, no_show_count) — rápido y sin joins.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  orderBy: z
    .enum(["spent", "visits", "no_shows"])
    .default("spent")
    .describe(
      "Criterio de orden: 'spent'=gasto total, 'visits'=visitas, 'no_shows'=no-shows.",
    ),
  limit: z.number().int().min(1).max(25).default(10),
  onlyVip: z.boolean().default(false),
});

interface TopCustomer {
  customerId: string;
  name: string | null;
  visits: number;
  totalSpentEur: string;
  noShows: number;
  isVip: boolean;
  lastBookingAt: string | null;
}

interface TopCustomersPayload {
  orderBy: string;
  count: number;
  items: TopCustomer[];
}

export function buildGetTopCustomersTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Ranking de los mejores (o peores) clientes. Criterios: gasto total, nº de visitas o nº de no-shows. Útil para '¿mis 5 mejores clientes?', '¿quién falla más?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<TopCustomersPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_top_customers",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const orderCol =
            input.orderBy === "spent"
              ? "total_spent_cents"
              : input.orderBy === "visits"
                ? "visits_count"
                : "no_show_count";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("customers")
            .select(
              "id, name, full_name, visits_count, total_spent_cents, no_show_count, is_vip, last_booking_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("is_banned", false)
            .order(orderCol, { ascending: false, nullsFirst: false })
            .limit(input.limit);

          if (input.onlyVip) query = query.eq("is_vip", true);

          const { data, error } = await query;
          if (error) return err("No se pudo calcular el ranking de clientes.");

          const items: TopCustomer[] = (
            (data as Array<{
              id: string;
              name: string | null;
              full_name: string | null;
              visits_count: number | null;
              total_spent_cents: number | null;
              no_show_count: number | null;
              is_vip: boolean | null;
              last_booking_at: string | null;
            }>) ?? []
          ).map((r) => ({
            customerId: r.id,
            name: r.full_name ?? r.name ?? null,
            visits: r.visits_count ?? 0,
            totalSpentEur: centsToEur(r.total_spent_cents ?? 0),
            noShows: r.no_show_count ?? 0,
            isVip: !!r.is_vip,
            lastBookingAt: r.last_booking_at,
          }));

          const label =
            input.orderBy === "spent"
              ? "por gasto"
              : input.orderBy === "visits"
                ? "por visitas"
                : "por no-shows";
          const summary =
            items.length === 0
              ? "No hay clientes registrados."
              : `Top ${items.length} ${label}.`;

          return ok<TopCustomersPayload>(summary, {
            orderBy: input.orderBy,
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
