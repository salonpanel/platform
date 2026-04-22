/**
 * Tool: get_booking_detail
 *
 * Ficha completa de una reserva: cliente, servicio, staff, fecha/hora,
 * duración, precio, estado, estado de pago, notas internas y canal.
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
  bookingId: z.string().uuid().describe("UUID de la reserva."),
});

interface BookingDetailPayload {
  bookingId: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  serviceName: string | null;
  serviceId: string | null;
  staffName: string | null;
  staffId: string;
  startsAtIso: string;
  endsAtIso: string;
  whenHuman: string;
  durationMin: number | null;
  status: string;
  paymentStatus: string;
  priceEur: string;
  priceCents: number;
  depositCents: number | null;
  internalNotes: string | null;
  clientMessage: string | null;
  channel: string | null;
  source: string | null;
}

export function buildGetBookingDetailTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Devuelve la ficha completa de una reserva concreta: cliente, servicio, staff, fecha/hora, estado, estado de pago, precio y notas. Útil cuando el usuario te da un bookingId o te pide detalle de 'la cita de Juan de las 10'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<BookingDetailPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_booking_detail",
          toolCategory: "READ_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("bookings")
            .select(
              "id, customer_id, staff_id, service_id, starts_at, ends_at, duration_min, status, payment_status, price_cents, deposit_amount_cents, internal_notes, client_message, booking_channel, booking_source, customer:customers(name, full_name, email, phone), service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          if (error) {
            return err("No se pudo consultar la reserva.");
          }
          if (!data) {
            return err("Reserva no encontrada en este negocio.");
          }

          const row = data as unknown as {
            id: string;
            customer_id: string;
            staff_id: string;
            service_id: string | null;
            starts_at: string;
            ends_at: string;
            duration_min: number | null;
            status: string;
            payment_status: string;
            price_cents: number | null;
            deposit_amount_cents: number | null;
            internal_notes: string | null;
            client_message: string | null;
            booking_channel: string | null;
            booking_source: string | null;
            customer: {
              name: string | null;
              full_name: string | null;
              email: string | null;
              phone: string | null;
            } | null;
            service: { name: string | null } | null;
            staff: { name: string | null; display_name: string | null } | null;
          };

          const payload: BookingDetailPayload = {
            bookingId: row.id,
            customerId: row.customer_id,
            customerName: row.customer?.full_name ?? row.customer?.name ?? null,
            customerPhone: row.customer?.phone ?? null,
            customerEmail: row.customer?.email ?? null,
            serviceName: row.service?.name ?? null,
            serviceId: row.service_id,
            staffName: row.staff?.display_name ?? row.staff?.name ?? null,
            staffId: row.staff_id,
            startsAtIso: row.starts_at,
            endsAtIso: row.ends_at,
            whenHuman: formatDateHuman(row.starts_at, tenantTimezone),
            durationMin: row.duration_min,
            status: row.status,
            paymentStatus: row.payment_status,
            priceEur: centsToEur(row.price_cents ?? 0),
            priceCents: row.price_cents ?? 0,
            depositCents: row.deposit_amount_cents,
            internalNotes: row.internal_notes,
            clientMessage: row.client_message,
            channel: row.booking_channel,
            source: row.booking_source,
          };

          const summary = `${payload.whenHuman} — ${payload.customerName ?? "(sin nombre)"} para ${payload.serviceName ?? "servicio"} con ${payload.staffName ?? "staff"}. Estado: ${payload.status}, pago: ${payload.paymentStatus}.`;

          return ok<BookingDetailPayload>(summary, payload);
        },
      );
    },
  });
}
