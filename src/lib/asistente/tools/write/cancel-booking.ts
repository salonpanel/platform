/**
 * Tool: cancel_booking
 *
 * Cancela una reserva cambiando status='cancelled' + booking_state='cancelled'.
 * Rechaza si ya está cancelada, completed o no-show.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  formatDateHuman,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z
    .string()
    .max(300)
    .optional()
    .describe("Motivo interno de la cancelación. Se guarda en internal_notes."),
  confirm: z.boolean().default(false),
});

interface CancelPayload {
  bookingId: string;
  customerName: string | null;
  serviceName: string | null;
  whenHuman: string;
  previousStatus: string;
  reason: string | null;
}

export function buildCancelBookingTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Cancela una reserva. Flujo: preview con la info de la cita → confirm. No cancela citas ya canceladas, completadas o marcadas como no-show.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<CancelPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "cancel_booking",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("bookings")
            .select(
              "id, starts_at, status, internal_notes, staff_id, customer:customers(name, full_name), service:services(name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          if (error || !data) return err("Reserva no encontrada.");

          const row = data as unknown as {
            id: string;
            starts_at: string;
            status: string;
            internal_notes: string | null;
            staff_id: string;
            customer: { name: string | null; full_name: string | null } | null;
            service: { name: string | null } | null;
          };

          if (["cancelled", "completed", "no_show"].includes(row.status)) {
            return err(
              `La reserva está en estado "${row.status}" — no se puede cancelar.`,
            );
          }

          // Staff solo cancela sus propias citas.
          if (ctx.userRole === "staff") {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (!selfStaffId || selfStaffId !== row.staff_id) {
              return err(
                "Como staff solo puedes cancelar tus propias citas.",
              );
            }
          }

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const serviceName = row.service?.name ?? null;
          const whenHuman = formatDateHuman(row.starts_at, tenantTimezone);

          const payload: CancelPayload = {
            bookingId: row.id,
            customerName,
            serviceName,
            whenHuman,
            previousStatus: row.status,
            reason: input.reason ?? null,
          };

          if (!input.confirm) {
            return preview(
              `Cancelar cita de **${customerName ?? "cliente"}** — ${serviceName ?? "servicio"} el ${whenHuman}${
                input.reason ? ` (motivo: ${input.reason})` : ""
              }. ¿La cancelo?`,
              payload,
            );
          }

          const prevNotes = row.internal_notes ?? "";
          const reasonLine = input.reason
            ? `\n[cancelada por IA: ${input.reason}]`
            : "\n[cancelada por IA]";
          const newNotes = (prevNotes + reasonLine).slice(0, 4000);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update({
              status: "cancelled",
              booking_state: "cancelled",
              internal_notes: newNotes,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo cancelar: ${updErr.message}`);

          return ok<CancelPayload>(
            `Cancelada la cita de **${customerName ?? "cliente"}** del ${whenHuman}.`,
            payload,
          );
        },
      );
    },
  });
}
