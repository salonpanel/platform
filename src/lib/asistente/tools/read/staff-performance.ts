/**
 * Tool: get_staff_performance
 *
 * Rendimiento del staff en un periodo: ingresos, nº citas, nº no-shows y
 * facturación media. Opcionalmente filtra por un staffId concreto.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  staffId: z
    .string()
    .uuid()
    .optional()
    .describe("Si se pasa, solo devuelve ese profesional."),
  orderBy: z.enum(["revenue", "bookings"]).default("revenue"),
});

interface StaffPerformanceItem {
  staffId: string;
  staffName: string;
  bookings: number;
  completed: number;
  noShows: number;
  cancelled: number;
  revenueEur: string;
  revenueCents: number;
  avgEur: string;
}

interface PerformancePayload {
  days: number;
  count: number;
  items: StaffPerformanceItem[];
}

export function buildGetStaffPerformanceTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Rendimiento del staff en los últimos N días: nº citas, completadas, no-shows, cancelaciones, ingresos y facturación media. Útil para '¿cómo rinde María?', '¿quién vende más?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<PerformancePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_staff_performance",
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
          let staffQ: any = supabase
            .from("staff")
            .select("id, name, display_name, active")
            .eq("tenant_id", ctx.tenantId);
          if (input.staffId) staffQ = staffQ.eq("id", input.staffId);
          const { data: staffList, error: staffErr } = await staffQ;
          if (staffErr) return err("No se pudo consultar el staff.");

          const staffArr =
            ((staffList as unknown) as Array<{
              id: string;
              name: string | null;
              display_name: string | null;
              active: boolean | null;
            }>) ?? [];

          if (staffArr.length === 0) return err("Sin staff para medir.");

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let bookingsQ: any = supabase
            .from("bookings")
            .select(
              "staff_id, status, payment_status, price_cents, starts_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .gte("starts_at", sinceIso);
          if (input.staffId) bookingsQ = bookingsQ.eq("staff_id", input.staffId);

          const { data: bookings, error: bkErr } = await bookingsQ;
          if (bkErr) return err("No se pudo consultar las reservas.");

          const bkRows =
            ((bookings as unknown) as Array<{
              staff_id: string;
              status: string;
              payment_status: string;
              price_cents: number | null;
            }>) ?? [];

          const perStaff = new Map<
            string,
            {
              bookings: number;
              completed: number;
              noShows: number;
              cancelled: number;
              cents: number;
            }
          >();

          for (const r of bkRows) {
            const cur = perStaff.get(r.staff_id) ?? {
              bookings: 0,
              completed: 0,
              noShows: 0,
              cancelled: 0,
              cents: 0,
            };
            cur.bookings += 1;
            if (r.status === "completed") cur.completed += 1;
            if (r.status === "no_show") cur.noShows += 1;
            if (r.status === "cancelled") cur.cancelled += 1;
            if (r.payment_status === "paid" && r.status !== "cancelled") {
              cur.cents += r.price_cents ?? 0;
            }
            perStaff.set(r.staff_id, cur);
          }

          const items: StaffPerformanceItem[] = staffArr.map((s) => {
            const stats = perStaff.get(s.id) ?? {
              bookings: 0,
              completed: 0,
              noShows: 0,
              cancelled: 0,
              cents: 0,
            };
            return {
              staffId: s.id,
              staffName: s.display_name ?? s.name ?? "(sin nombre)",
              bookings: stats.bookings,
              completed: stats.completed,
              noShows: stats.noShows,
              cancelled: stats.cancelled,
              revenueEur: centsToEur(stats.cents),
              revenueCents: stats.cents,
              avgEur: centsToEur(
                stats.completed > 0 ? Math.round(stats.cents / stats.completed) : 0,
              ),
            };
          });

          items.sort((a, b) =>
            input.orderBy === "revenue"
              ? b.revenueCents - a.revenueCents
              : b.bookings - a.bookings,
          );

          const summary =
            items.length === 0
              ? "Sin datos de rendimiento."
              : `Rendimiento del equipo (últimos ${input.days} días).`;

          return ok<PerformancePayload>(summary, {
            days: input.days,
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
