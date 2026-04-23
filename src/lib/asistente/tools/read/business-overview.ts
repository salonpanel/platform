/**
 * Tool: get_business_overview
 *
 * Snapshot rápido del día. Combina daily_metrics (si existe para hoy) con
 * queries en vivo para: próxima cita, pendientes de pago, staff en turno.
 * Es el "dime cómo va" genérico: el LLM puede llamarla al empezar la
 * conversación o cuando el usuario pregunte "qué tal el día?".
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  centsToEur,
  formatDateHuman,
  formatEur,
  ok,
  err,
  withAudit,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({}).describe("Sin parámetros — snapshot del día.");

interface OverviewPayload {
  dateIso: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  revenueEur: string;
  occupancyPercent: number | null;
  avgTicketEur: string;
  activeStaffCount: number;
  nextBooking: {
    bookingId: string;
    whenHuman: string;
    customerName: string | null;
    serviceName: string | null;
    staffName: string | null;
  } | null;
  pendingPaymentsCount: number;
  pendingPaymentsEur: string;
}

export function buildGetBusinessOverviewTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Snapshot del día: nº citas, completadas, canceladas, ingresos de hoy, ocupación, ticket medio, próxima cita y pendientes de pago. Úsala al inicio de una conversación o cuando el usuario pregunte '¿cómo va el día?', '¿qué tengo hoy?'.",
    inputSchema: InputSchema,
    execute: async (): Promise<ToolOutput<OverviewPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_business_overview",
          toolCategory: "READ_LOW",
          toolInput: null,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          // Fecha "hoy" en la zona del tenant (YYYY-MM-DD).
          const today = new Date()
            .toLocaleDateString("en-CA", { timeZone: tenantTimezone });

          // Métrica pre-agregada (puede no existir aún si el cron no ha corrido).
          const metricsPromise = supabase
            .from("daily_metrics")
            .select(
              "total_bookings, completed_bookings, cancelled_bookings, no_show_bookings, confirmed_bookings, revenue_cents, occupancy_percent, avg_ticket_cents, active_staff",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("metric_date", today)
            .maybeSingle();

          // Próxima cita futura (desde ahora).
          const nowIso = new Date().toISOString();
          const nextPromise = supabase
            .from("bookings")
            .select(
              "id, starts_at, customer:customers(name, full_name), service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .in("status", ["pending", "confirmed"])
            .gte("starts_at", nowIso)
            .order("starts_at", { ascending: true })
            .limit(1);

          // Bookings de hoy por status (fallback si no hay daily_metrics).
          const startOfDay = new Date(`${today}T00:00:00`);
          const endOfDay = new Date(`${today}T23:59:59`);
          const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
          const startIso = new Date(startOfDay.getTime() - offsetMs).toISOString();
          const endIso = new Date(endOfDay.getTime() - offsetMs).toISOString();

          const bookingsTodayPromise = supabase
            .from("bookings")
            .select("status")
            .eq("tenant_id", ctx.tenantId)
            .gte("starts_at", startIso)
            .lte("starts_at", endIso);

          // Pagos pendientes (estado payment_status != paid en bookings con cita hoy o pasadas).
          const pendingPromise = supabase
            .from("bookings")
            .select("price_cents, payment_status, status")
            .eq("tenant_id", ctx.tenantId)
            .in("status", ["confirmed", "completed"])
            .in("payment_status", ["unpaid", "deposit"]);

          const [
            { data: metrics },
            { data: nextData },
            { data: todayData },
            { data: pendingData },
          ] = await Promise.all([
            metricsPromise,
            nextPromise,
            bookingsTodayPromise,
            pendingPromise,
          ]);

          if (!metrics && !todayData) {
            return err("No se pudo consultar métricas del día.");
          }

          // Fallback: contar status a mano si no hay row en daily_metrics.
          const statusRows =
            ((todayData as Array<{ status: string }> | null) ?? []);
          const counts = statusRows.reduce(
            (acc, r) => {
              acc.total += 1;
              if (r.status === "completed") acc.completed += 1;
              if (r.status === "cancelled") acc.cancelled += 1;
              if (r.status === "no_show") acc.noShow += 1;
              if (r.status === "pending") acc.pending += 1;
              if (r.status === "confirmed") acc.confirmed += 1;
              return acc;
            },
            { total: 0, completed: 0, cancelled: 0, noShow: 0, pending: 0, confirmed: 0 },
          );

          const m = metrics as {
            total_bookings: number | null;
            completed_bookings: number | null;
            cancelled_bookings: number | null;
            no_show_bookings: number | null;
            confirmed_bookings: number | null;
            revenue_cents: number | null;
            occupancy_percent: number | null;
            avg_ticket_cents: number | null;
            active_staff: number | null;
          } | null;

          const nextArr = (nextData as unknown as Array<{
            id: string;
            starts_at: string;
            customer: { name: string | null; full_name: string | null } | null;
            service: { name: string | null } | null;
            staff: { name: string | null; display_name: string | null } | null;
          }> | null) ?? [];
          const next = nextArr[0] ?? null;

          const pendingRows =
            ((pendingData as Array<{ price_cents: number | null }> | null) ?? []);
          const pendingCents = pendingRows.reduce(
            (acc, r) => acc + (r.price_cents ?? 0),
            0,
          );

          const payload: OverviewPayload = {
            dateIso: today,
            totalBookings: m?.total_bookings ?? counts.total,
            completedBookings: m?.completed_bookings ?? counts.completed,
            cancelledBookings: m?.cancelled_bookings ?? counts.cancelled,
            noShowBookings: m?.no_show_bookings ?? counts.noShow,
            pendingBookings: counts.pending,
            confirmedBookings: m?.confirmed_bookings ?? counts.confirmed,
            revenueEur: centsToEur(Number(m?.revenue_cents ?? 0)),
            occupancyPercent: m?.occupancy_percent ?? null,
            avgTicketEur: centsToEur(Number(m?.avg_ticket_cents ?? 0)),
            activeStaffCount: m?.active_staff ?? 0,
            nextBooking: next
              ? {
                  bookingId: next.id,
                  whenHuman: formatDateHuman(next.starts_at, tenantTimezone),
                  customerName:
                    next.customer?.full_name ?? next.customer?.name ?? null,
                  serviceName: next.service?.name ?? null,
                  staffName:
                    next.staff?.display_name ?? next.staff?.name ?? null,
                }
              : null,
            pendingPaymentsCount: pendingRows.length,
            pendingPaymentsEur: centsToEur(pendingCents),
          };

          const parts: string[] = [];
          parts.push(
            `Hoy ${payload.totalBookings} cita(s) · ${payload.revenueEur} cobrado`,
          );
          if (payload.occupancyPercent != null)
            parts.push(`ocupación ${payload.occupancyPercent}%`);
          if (payload.nextBooking)
            parts.push(
              `próxima: ${payload.nextBooking.whenHuman} (${payload.nextBooking.customerName ?? "cliente"})`,
            );
          if (payload.pendingPaymentsCount > 0)
            parts.push(
              `${payload.pendingPaymentsCount} pendiente(s) de pago (${payload.pendingPaymentsEur})`,
            );

          return ok<OverviewPayload>(parts.join(" · ") + ".", payload);
        },
      );
    },
  });
}
