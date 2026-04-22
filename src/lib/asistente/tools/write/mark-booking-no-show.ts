/**
 * Tool: mark_booking_no_show
 *
 * Marca una reserva como no-show. Solo válido para citas pasadas y
 * confirmadas/pendientes. Incrementa el contador no_show_count del cliente.
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
  confirm: z.boolean().default(false),
});

interface NoShowPayload {
  bookingId: string;
  customerName: string | null;
  serviceName: string | null;
  whenHuman: string;
}

export function buildMarkBookingNoShowTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Marca una reserva como no-show (el cliente no se presentó). Solo citas pasadas y no ya canceladas/completadas. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<NoShowPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "mark_booking_no_show",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("bookings")
            .select(
              "id, starts_at, status, customer_id, staff_id, customer:customers(name, full_name, no_show_count), service:services(name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          if (error || !data) return err("Reserva no encontrada.");

          const row = data as unknown as {
            id: string;
            starts_at: string;
            status: string;
            customer_id: string;
            staff_id: string;
            customer: {
              name: string | null;
              full_name: string | null;
              no_show_count: number | null;
            } | null;
            service: { name: string | null } | null;
          };

          if (new Date(row.starts_at).getTime() > Date.now()) {
            return err("Aún no se puede marcar como no-show: la cita es futura.");
          }
          if (["cancelled", "completed", "no_show"].includes(row.status)) {
            return err(`La reserva ya está en estado "${row.status}".`);
          }

          if (ctx.userRole === "staff") {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (!selfStaffId || selfStaffId !== row.staff_id) {
              return err("Como staff solo puedes marcar no-show de tus propias citas.");
            }
          }

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const serviceName = row.service?.name ?? null;
          const payload: NoShowPayload = {
            bookingId: row.id,
            customerName,
            serviceName,
            whenHuman: formatDateHuman(row.starts_at, tenantTimezone),
          };

          if (!input.confirm) {
            return preview(
              `Marcar como no-show la cita de **${customerName ?? "cliente"}** (${payload.whenHuman}). ¿Lo hago?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update({
              status: "no_show",
              booking_state: "no_show",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo marcar: ${updErr.message}`);

          // Incrementar contador del cliente (best effort).
          const prev = row.customer?.no_show_count ?? 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("customers") as any)
            .update({
              no_show_count: prev + 1,
              last_no_show_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", row.customer_id);

          return ok<NoShowPayload>(
            `Marcada como no-show — ${customerName ?? "cliente"}, ${payload.whenHuman}.`,
            payload,
          );
        },
      );
    },
  });
}
