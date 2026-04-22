/**
 * Tool: list_bookings_range
 *
 * Reservas en un rango arbitrario (mañana, esta semana, del 1 al 5, etc.).
 * Filtros opcionales: staff, customer, service, estado, pago.
 *
 * A diferencia de get_today_agenda (rango = un día), este cubre preguntas
 * tipo "¿qué tenemos esta semana?", "¿María tiene algo mañana?", etc.
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

const InputSchema = z
  .object({
    fromDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Fecha inicio (YYYY-MM-DD) en tz del negocio."),
    toDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Fecha fin inclusive (YYYY-MM-DD)."),
    staffId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    status: z
      .enum(["pending", "confirmed", "completed", "cancelled", "no_show"])
      .optional(),
    onlyUnpaid: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .refine((v) => v.fromDate <= v.toDate, {
    message: "fromDate debe ser <= toDate.",
  });

interface BookingItem {
  bookingId: string;
  whenHuman: string;
  startIso: string;
  customerName: string | null;
  serviceName: string | null;
  staffName: string | null;
  status: string;
  paymentStatus: string;
  priceEur: string;
}

interface ListPayload {
  fromDate: string;
  toDate: string;
  count: number;
  totalEur: string;
  items: BookingItem[];
}

export function buildListBookingsRangeTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista reservas en un rango de fechas (fromDate..toDate, inclusive). Filtros opcionales por staff, customer, servicio, estado o solo no-pagadas. Útil para '¿qué tenemos esta semana?', '¿Juan qué tiene mañana?', 'enséñame cancelaciones del mes'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_bookings_range",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          // Rango amplio UTC con padding para cubrir tz.
          const startIso = new Date(
            `${input.fromDate}T00:00:00Z`,
          ).toISOString();
          const endIso = new Date(
            new Date(`${input.toDate}T23:59:59Z`).getTime() + 24 * 3600 * 1000,
          ).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("bookings")
            .select(
              "id, starts_at, status, payment_status, price_cents, customer:customers(name, full_name), service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .gte("starts_at", startIso)
            .lte("starts_at", endIso)
            .order("starts_at", { ascending: true })
            .limit(input.limit);

          if (input.staffId) query = query.eq("staff_id", input.staffId);
          if (input.customerId) query = query.eq("customer_id", input.customerId);
          if (input.serviceId) query = query.eq("service_id", input.serviceId);
          if (input.status) query = query.eq("status", input.status);
          if (input.onlyUnpaid) query = query.eq("payment_status", "unpaid");

          const { data, error } = await query;
          if (error) return err("No se pudieron consultar las reservas.");

          const rows =
            ((data as unknown) as Array<{
              id: string;
              starts_at: string;
              status: string;
              payment_status: string;
              price_cents: number | null;
              customer: { name: string | null; full_name: string | null } | null;
              service: { name: string | null } | null;
              staff: { name: string | null; display_name: string | null } | null;
            }>) ?? [];

          // Filtrado fino por tz local (por si el padding UTC nos coló algo).
          const inRange = rows.filter((r) => {
            const localDate = new Intl.DateTimeFormat("en-CA", {
              timeZone: tenantTimezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(r.starts_at));
            return localDate >= input.fromDate && localDate <= input.toDate;
          });

          let totalCents = 0;
          const items: BookingItem[] = inRange.map((r) => {
            totalCents += r.price_cents ?? 0;
            return {
              bookingId: r.id,
              whenHuman: formatDateHuman(r.starts_at, tenantTimezone),
              startIso: r.starts_at,
              customerName: r.customer?.full_name ?? r.customer?.name ?? null,
              serviceName: r.service?.name ?? null,
              staffName: r.staff?.display_name ?? r.staff?.name ?? null,
              status: r.status,
              paymentStatus: r.payment_status,
              priceEur: centsToEur(r.price_cents ?? 0),
            };
          });

          const rangeText =
            input.fromDate === input.toDate
              ? `el ${input.fromDate}`
              : `del ${input.fromDate} al ${input.toDate}`;
          const summary =
            items.length === 0
              ? `Sin reservas ${rangeText}.`
              : `${items.length} reserva(s) ${rangeText} · total ${centsToEur(totalCents)}.`;

          return ok<ListPayload>(summary, {
            fromDate: input.fromDate,
            toDate: input.toDate,
            count: items.length,
            totalEur: centsToEur(totalCents),
            items,
          });
        },
      );
    },
  });
}
