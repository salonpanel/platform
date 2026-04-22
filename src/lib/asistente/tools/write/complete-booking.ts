/**
 * Tool: complete_booking
 *
 * Marca una reserva como completada (booking_state='completed'). Suele
 * ocurrir al final de la cita, cuando el servicio se ha dado.
 *
 * No cambia payment_status (si estaba unpaid, sigue unpaid — el cliente
 * paga aparte con mark_booking_paid).
 *
 * Rechazos típicos: cita futura (>30 min en el futuro), ya cancelada /
 * ya completada / no-show.
 *
 * RBAC: staff solo para sus propias citas; manager+ cualquiera.
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

interface CompletePayload {
  bookingId: string;
  customerName: string | null;
  whenHuman: string;
  paymentStatus: string;
}

const FUTURE_TOLERANCE_MS = 30 * 60 * 1000; // 30 min de margen (cita en curso).

export function buildCompleteBookingTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Marca una reserva como completada (booking_state='completed'). Normalmente al terminar el servicio. No modifica el pago. Rechaza citas futuras (>30min vista) o ya en estado final. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<CompletePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "complete_booking",
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
              "id, staff_id, starts_at, status, booking_state, payment_status, customer:customers(name, full_name)",
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
            payment_status: string;
            customer: { name: string | null; full_name: string | null } | null;
          } | null;

          if (!row) return err("Reserva no encontrada.");

          if (["cancelled", "completed", "no_show"].includes(row.booking_state)) {
            return err(
              `La reserva ya está en estado "${row.booking_state}".`,
            );
          }

          const startMs = new Date(row.starts_at).getTime();
          if (startMs - Date.now() > FUTURE_TOLERANCE_MS) {
            return err(
              "La cita es futura — no se puede marcar como completada todavía.",
            );
          }

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
                "completar citas de otro profesional",
                ctx.userRole,
              );
            }
          }

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const whenHuman = formatDateHuman(row.starts_at, tenantTimezone);
          const payload: CompletePayload = {
            bookingId: row.id,
            customerName,
            whenHuman,
            paymentStatus: row.payment_status,
          };

          if (!input.confirm) {
            const paymentNote =
              row.payment_status === "paid"
                ? ""
                : `\n💶 Aviso: aún consta como "${row.payment_status}" — recuerda marcar el cobro con mark_booking_paid si procede.`;
            return preview(
              `Cerrar la cita de **${customerName ?? "cliente"}** del ${whenHuman} como completada.${paymentNote}\n¿Lo hago?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update({
              booking_state: "completed",
              status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo completar: ${updErr.message}`);

          return ok<CompletePayload>(
            `Completada la cita de **${customerName ?? "cliente"}** del ${whenHuman}.`,
            payload,
          );
        },
      );
    },
  });
}
