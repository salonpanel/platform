/**
 * Tool: confirm_booking
 *
 * Transiciona una reserva de pending → confirmed.
 * Útil cuando el cliente confirma por teléfono/WhatsApp una cita en hold.
 *
 * No toca payment_status — eso lo lleva mark_booking_paid. Solo confirma
 * la intención de asistencia.
 *
 * RBAC: staff solo para sus propias citas; manager+ para cualquiera.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  denyByRole,
  formatDateHuman,
  hasRoleAtLeast,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  bookingId: z.string().uuid(),
  confirm: z.boolean().default(false),
});

interface ConfirmPayload {
  bookingId: string;
  customerName: string | null;
  whenHuman: string;
  previousState: string;
}

export function buildConfirmBookingTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Marca una reserva como confirmada (booking_state = 'confirmed'). Para cuando el cliente confirma asistencia. No afecta al pago. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<ConfirmPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "confirm_booking",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data } = await supabase
            .from("bookings")
            .select(
              "id, staff_id, starts_at, status, booking_state, customer:customers(name, full_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          const row = data as unknown as {
            id: string;
            staff_id: string;
            starts_at: string;
            status: string;
            booking_state: string;
            customer: { name: string | null; full_name: string | null } | null;
          } | null;

          if (!row) return err("Reserva no encontrada.");

          // Estados terminales.
          if (["cancelled", "completed", "no_show"].includes(row.booking_state)) {
            return err(
              `La reserva está en estado "${row.booking_state}" — no se puede confirmar.`,
            );
          }
          if (row.booking_state === "confirmed") {
            return err("La reserva ya está confirmada.");
          }

          // RBAC: staff solo puede confirmar su propia cita.
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (!selfStaffId || selfStaffId !== row.staff_id) {
              return denyByRole(
                "confirmar citas de otro profesional",
                ctx.userRole,
              );
            }
          }

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const whenHuman = formatDateHuman(row.starts_at, tenantTimezone);
          const payload: ConfirmPayload = {
            bookingId: row.id,
            customerName,
            whenHuman,
            previousState: row.booking_state,
          };

          if (!input.confirm) {
            return preview(
              `Confirmar la cita de **${customerName ?? "cliente"}** del ${whenHuman} (ahora "${row.booking_state}").\n¿La confirmo?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update({
              booking_state: "confirmed",
              status: "confirmed",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo confirmar: ${updErr.message}`);

          return ok<ConfirmPayload>(
            `Confirmada la cita de **${customerName ?? "cliente"}** del ${whenHuman}.`,
            payload,
          );
        },
      );
    },
  });
}
