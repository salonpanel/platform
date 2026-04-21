/**
 * Tool: get_today_agenda
 *
 * Devuelve las citas del día (o de una fecha indicada) del tenant, con
 * cliente, servicio, staff, hora y estado.
 *
 * Tool category: READ_LOW.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatTime, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      "Fecha en formato YYYY-MM-DD en la zona horaria del negocio. Si se omite, usa hoy.",
    ),
  staffId: z
    .string()
    .uuid()
    .optional()
    .describe("Filtra por un miembro del staff concreto (UUID)."),
  limit: z.number().int().min(1).max(100).default(50),
});

interface AgendaItem {
  bookingId: string;
  startTime: string;
  endTime: string;
  customerName: string | null;
  serviceName: string | null;
  staffName: string | null;
  status: string;
  paymentStatus: string | null;
}

interface AgendaPayload {
  date: string;
  count: number;
  items: AgendaItem[];
}

export function buildGetTodayAgendaTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista las citas de la agenda para una fecha (por defecto hoy). Devuelve hora de inicio/fin, nombre del cliente, servicio, staff asignado y estado de la reserva y del pago. Útil para responder '¿qué tengo hoy?' o '¿qué tiene Juan mañana?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<AgendaPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_today_agenda",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          // Calculamos bounds en UTC a partir de la fecha local del tenant.
          const tz = tenantTimezone || "Europe/Madrid";
          const dateLocal =
            input.date ??
            new Intl.DateTimeFormat("en-CA", {
              timeZone: tz,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date());

          const dayStart = new Date(`${dateLocal}T00:00:00`);
          const dayEnd = new Date(`${dateLocal}T23:59:59.999`);
          // Nota: estos Dates se interpretan como local del runtime del server.
          // Para mayor exactitud, dejamos que Postgres filtre con rangos amplios
          // y luego filtramos en cliente.
          const startIso = new Date(
            dayStart.getTime() - 12 * 3600 * 1000,
          ).toISOString();
          const endIso = new Date(
            dayEnd.getTime() + 12 * 3600 * 1000,
          ).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("bookings")
            .select(
              "id, starts_at, ends_at, status, payment_status, customer:customers(name, full_name), service:services(name), staff:staff(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .gte("starts_at", startIso)
            .lte("starts_at", endIso)
            .in("status", ["confirmed", "completed"])
            .order("starts_at", { ascending: true })
            .limit(input.limit);

          if (input.staffId) {
            query = query.eq("staff_id", input.staffId);
          }

          const { data, error } = await query;
          if (error) {
            return err(
              "No se pudo consultar la agenda.",
              "Reintenta en un momento.",
            );
          }

          // Filtrado fino por fecha local del tenant.
          const rows =
            (data as Array<{
              id: string;
              starts_at: string;
              ends_at: string;
              status: string;
              payment_status: string | null;
              customer: { name: string | null; full_name: string | null } | null;
              service: { name: string | null } | null;
              staff: { name: string | null; display_name: string | null } | null;
            }>) ?? [];

          const items: AgendaItem[] = rows
            .filter((r) => {
              const localDate = new Intl.DateTimeFormat("en-CA", {
                timeZone: tz,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(r.starts_at));
              return localDate === dateLocal;
            })
            .map((r) => ({
              bookingId: r.id,
              startTime: formatTime(r.starts_at, tz),
              endTime: formatTime(r.ends_at, tz),
              customerName: r.customer?.full_name ?? r.customer?.name ?? null,
              serviceName: r.service?.name ?? null,
              staffName: r.staff?.display_name ?? r.staff?.name ?? null,
              status: r.status,
              paymentStatus: r.payment_status,
            }));

          const summary =
            items.length === 0
              ? `No hay citas programadas para el ${dateLocal}.`
              : `Hay ${items.length} cita(s) el ${dateLocal}.`;

          return ok<AgendaPayload>(summary, {
            date: dateLocal,
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
