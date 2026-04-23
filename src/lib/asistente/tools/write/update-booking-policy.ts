/**
 * Tool: update_booking_policy
 *
 * Aviso mínimo de cancelación y ventana de reserva (columnas en `tenants`).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  denyByRole,
  hasRoleAtLeast,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  cancellationHoursNotice: z
    .number()
    .int()
    .min(0)
    .max(168)
    .optional()
    .describe("Horas mínimas de aviso para cancelar sin penalty (0–168)."),
  bookingWindowDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Días hacia adelante que se pueden reservar."),
  confirm: z.boolean().default(false),
});

interface Payload {
  changes: string[];
  cancellationBefore: number | null;
  bookingWindowBefore: number | null;
}

export function buildUpdateBookingPolicyTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Actualiza aviso mínimo de cancelación (horas) y/o la ventana de días a futuro para reservar. Requiere manager+; al menos un campo; preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_booking_policy",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("cambiar la política de reservas", ctx.userRole);
          }

          if (
            input.cancellationHoursNotice === undefined &&
            input.bookingWindowDays === undefined
          ) {
            return err("Indica al menos cancelación (horas) o ventana de días.");
          }

          const supabase = getSupabaseAdmin();
          const { data: t0, error: fErr } = await (supabase.from("tenants") as any)
            .select("id, cancellation_hours_notice, booking_window_days")
            .eq("id", ctx.tenantId)
            .maybeSingle();

          if (fErr || !t0) {
            return err("No se pudo leer el negocio.");
          }

          const t = t0 as {
            cancellation_hours_notice: number | null;
            booking_window_days: number | null;
          };

          const changes: string[] = [];
          const patch: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (input.cancellationHoursNotice !== undefined) {
            const a = t.cancellation_hours_notice;
            if (a !== input.cancellationHoursNotice) {
              changes.push(
                `aviso cancelación: ${a ?? "—"}h → ${input.cancellationHoursNotice}h`,
              );
              patch.cancellation_hours_notice = input.cancellationHoursNotice;
            }
          }
          if (input.bookingWindowDays !== undefined) {
            const a = t.booking_window_days;
            if (a !== input.bookingWindowDays) {
              changes.push(
                `ventana de reservas: ${a ?? "—"} días → ${input.bookingWindowDays} días`,
              );
              patch.booking_window_days = input.bookingWindowDays;
            }
          }

          if (changes.length === 0) {
            return err("Los valores son iguales a los actuales — nada que cambiar.");
          }

          const payload: Payload = {
            changes,
            cancellationBefore: t.cancellation_hours_notice,
            bookingWindowBefore: t.booking_window_days,
          };

          if (!input.confirm) {
            return preview(
              "Cambios en política de reservas:\n" +
                changes.map((c) => `- ${c}`).join("\n") +
                "\n\n¿Aplico?",
              payload,
              "Listo para actualizar la política de reservas.",
            );
          }

          const { error: uErr } = await (supabase.from("tenants") as any)
            .update(patch)
            .eq("id", ctx.tenantId);

          if (uErr) {
            return err("No se pudo guardar la política.");
          }

          return ok<Payload>(`Listo: ${changes.length} ajuste(s) aplicado(s).`, {
            ...payload,
          });
        },
      );
    },
  });
}
