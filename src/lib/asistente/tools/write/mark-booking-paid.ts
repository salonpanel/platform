/**
 * Tool: mark_booking_paid
 *
 * Marca una reserva como pagada (payment_status='paid'). Útil para cobros
 * en efectivo/TPV físico que no pasan por Stripe. NO mueve dinero ni registra
 * el método — solo marca el estado.
 *
 * RBAC: owner/admin/manager (staff no puede marcar cobros).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  centsToEur,
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
  method: z
    .enum(["cash", "card_in_person", "bank_transfer", "other"])
    .default("cash"),
  confirm: z.boolean().default(false),
});

interface MarkPaidPayload {
  bookingId: string;
  customerName: string | null;
  serviceName: string | null;
  whenHuman: string;
  amountEur: string;
  method: string;
}

export function buildMarkBookingPaidTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Marca una reserva como pagada (sin mover dinero real; es para cobros en efectivo o TPV físico). Requiere rol manager o superior. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (
      input,
    ): Promise<ToolOutputWithPreview<MarkPaidPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "mark_booking_paid",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("marcar cobros", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("bookings")
            .select(
              "id, starts_at, price_cents, status, payment_status, internal_notes, customer:customers(name, full_name), service:services(name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          if (error || !data) return err("Reserva no encontrada.");

          const row = data as unknown as {
            id: string;
            starts_at: string;
            price_cents: number | null;
            status: string;
            payment_status: string;
            internal_notes: string | null;
            customer: { name: string | null; full_name: string | null } | null;
            service: { name: string | null } | null;
          };

          if (row.payment_status === "paid") {
            return err("Esa reserva ya está marcada como pagada.");
          }
          if (row.status === "cancelled") {
            return err("No se puede cobrar una reserva cancelada.");
          }

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const serviceName = row.service?.name ?? null;
          const payload: MarkPaidPayload = {
            bookingId: row.id,
            customerName,
            serviceName,
            whenHuman: formatDateHuman(row.starts_at, tenantTimezone),
            amountEur: centsToEur(row.price_cents ?? 0),
            method: input.method,
          };

          if (!input.confirm) {
            return preview(
              `Marcar como pagada la cita de **${customerName ?? "cliente"}** (${payload.whenHuman}) — ${payload.amountEur} vía ${input.method}. ¿Confirmo?`,
              payload,
            );
          }

          const prevNotes = row.internal_notes ?? "";
          const noteLine = `\n[pagado por IA · ${input.method} · ${new Date().toISOString()}]`;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update({
              payment_status: "paid",
              internal_notes: (prevNotes + noteLine).slice(0, 4000),
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo marcar como pagado: ${updErr.message}`);

          return ok<MarkPaidPayload>(
            `Marcada como pagada — ${payload.amountEur} (${input.method}).`,
            payload,
          );
        },
      );
    },
  });
}
