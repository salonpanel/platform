/**
 * Tool: reschedule_booking
 *
 * Cambia fecha/hora (y opcionalmente staff) de una reserva. Mantiene el
 * servicio y cliente. Verifica conflictos en el nuevo hueco.
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
  newStartIso: z
    .string()
    .describe("Nuevo inicio en ISO 8601 con tz."),
  newStaffId: z
    .string()
    .uuid()
    .optional()
    .describe("Si cambia de profesional. Si se omite, mantiene el actual."),
  confirm: z.boolean().default(false),
});

interface ReschedulePayload {
  bookingId: string;
  customerName: string | null;
  serviceName: string | null;
  fromHuman: string;
  toHuman: string;
  staffChange: { from: string | null; to: string | null } | null;
}

export function buildRescheduleBookingTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Mueve una reserva a una nueva fecha/hora (opcionalmente a otro profesional). Verifica conflictos antes. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (
      input,
    ): Promise<ToolOutputWithPreview<ReschedulePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "reschedule_booking",
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
              "id, starts_at, ends_at, duration_min, status, staff_id, service_id, customer:customers(name, full_name), service:services(name, duration_min), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          if (error || !data) return err("Reserva no encontrada.");

          const row = data as unknown as {
            id: string;
            starts_at: string;
            ends_at: string;
            duration_min: number | null;
            status: string;
            staff_id: string;
            service_id: string | null;
            customer: { name: string | null; full_name: string | null } | null;
            service: { name: string | null; duration_min: number | null } | null;
            staff: { name: string | null; display_name: string | null } | null;
          };

          if (["cancelled", "completed", "no_show"].includes(row.status)) {
            return err(
              `La reserva está en estado "${row.status}" — no se puede reprogramar.`,
            );
          }

          if (ctx.userRole === "staff") {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (
              !selfStaffId ||
              selfStaffId !== row.staff_id ||
              (input.newStaffId && input.newStaffId !== selfStaffId)
            ) {
              return err(
                "Como staff solo puedes reprogramar tus propias citas y no asignarlas a otro profesional.",
              );
            }
          }

          const newStartMs = new Date(input.newStartIso).getTime();
          if (Number.isNaN(newStartMs))
            return err("newStartIso no es una fecha válida.");
          if (newStartMs < Date.now() - 5 * 60 * 1000)
            return err("No se puede mover una cita al pasado.");

          const durationMin =
            row.duration_min ?? row.service?.duration_min ?? 30;
          const newEndMs = newStartMs + durationMin * 60 * 1000;
          const newStartIso = new Date(newStartMs).toISOString();
          const newEndIso = new Date(newEndMs).toISOString();
          const staffIdToUse = input.newStaffId ?? row.staff_id;

          // Conflictos.
          const { data: conflicts } = await supabase
            .from("bookings")
            .select("id")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", staffIdToUse)
            .neq("id", input.bookingId)
            .in("status", ["pending", "confirmed", "completed"])
            .lt("starts_at", newEndIso)
            .gt("ends_at", newStartIso);
          if (((conflicts as unknown[]) ?? []).length > 0) {
            return err(
              "El nuevo hueco choca con otra cita del mismo profesional.",
              "Usa find_available_slots para ver opciones libres.",
            );
          }

          // Nombres para preview.
          let newStaffName: string | null = null;
          if (input.newStaffId && input.newStaffId !== row.staff_id) {
            const { data: st } = await supabase
              .from("staff")
              .select("name, display_name")
              .eq("tenant_id", ctx.tenantId)
              .eq("id", input.newStaffId)
              .maybeSingle();
            const s = st as {
              name: string | null;
              display_name: string | null;
            } | null;
            newStaffName = s?.display_name ?? s?.name ?? null;
          }

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const serviceName = row.service?.name ?? null;
          const fromHuman = formatDateHuman(row.starts_at, tenantTimezone);
          const toHuman = formatDateHuman(newStartIso, tenantTimezone);
          const prevStaffName =
            row.staff?.display_name ?? row.staff?.name ?? null;

          const staffChange =
            input.newStaffId && input.newStaffId !== row.staff_id
              ? { from: prevStaffName, to: newStaffName }
              : null;

          const payload: ReschedulePayload = {
            bookingId: row.id,
            customerName,
            serviceName,
            fromHuman,
            toHuman,
            staffChange,
          };

          if (!input.confirm) {
            const staffPart = staffChange
              ? ` y cambiar profesional de ${staffChange.from ?? "?"} a ${staffChange.to ?? "?"}`
              : "";
            return preview(
              `Mover la cita de **${customerName ?? "cliente"}** (${serviceName ?? "servicio"}) del ${fromHuman} al ${toHuman}${staffPart}. ¿Lo hago?`,
              payload,
            );
          }

          const patch: Record<string, unknown> = {
            starts_at: newStartIso,
            ends_at: newEndIso,
            updated_at: new Date().toISOString(),
          };
          if (input.newStaffId && input.newStaffId !== row.staff_id) {
            patch.staff_id = input.newStaffId;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update(patch)
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo reprogramar: ${updErr.message}`);

          return ok<ReschedulePayload>(
            `Cita de **${customerName ?? "cliente"}** movida al ${toHuman}.`,
            payload,
          );
        },
      );
    },
  });
}
