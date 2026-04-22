/**
 * Tool: block_staff_time
 *
 * Crea un staff_blocking (vacaciones, descanso, reunión, etc.). Esto hace
 * que find_available_slots no oferte esos huecos. Aviso: no cancela citas
 * que ya existan dentro del rango — solo bloquea NUEVAS reservas.
 *
 * RBAC: staff puede bloquear su propio tiempo; manager+ a cualquiera.
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
  staffId: z.string().uuid(),
  startIso: z.string().describe("Inicio del bloqueo en ISO 8601."),
  endIso: z.string().describe("Fin del bloqueo en ISO 8601."),
  type: z
    .enum(["block", "absence", "vacation"])
    .default("block")
    .describe(
      "'vacation'=vacaciones; 'absence'=ausencia (enfermedad, personal); 'block'=bloqueo puntual (reunión, descanso).",
    ),
  reason: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Motivo legible (ej. 'Vacaciones verano', 'Formación', 'Enfermedad').",
    ),
  confirm: z.boolean().default(false),
});

interface BlockPayload {
  blockingId?: string;
  staffName: string | null;
  fromHuman: string;
  toHuman: string;
  type: string;
  reason: string | null;
  existingBookings: number;
}

export function buildBlockStaffTimeTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Bloquea un rango de tiempo para un profesional (vacaciones, reunión, enfermedad, etc.). No cancela citas ya existentes en ese rango — avisa si las hay. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<BlockPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "block_staff_time",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          // RBAC: staff solo para sí.
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (!selfStaffId || selfStaffId !== input.staffId) {
              return denyByRole("bloquear tiempo de otros", ctx.userRole);
            }
          }

          const startMs = new Date(input.startIso).getTime();
          const endMs = new Date(input.endIso).getTime();
          if (Number.isNaN(startMs) || Number.isNaN(endMs))
            return err("Fechas inválidas.");
          if (endMs <= startMs)
            return err("El fin debe ser posterior al inicio.");

          // Staff + conteo de citas afectadas.
          const { data: staffRow } = await supabase
            .from("staff")
            .select("id, name, display_name, active")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();
          const staff = staffRow as {
            id: string;
            name: string | null;
            display_name: string | null;
            active: boolean | null;
          } | null;
          if (!staff) return err("Profesional no encontrado.");

          const { data: conflicts } = await supabase
            .from("bookings")
            .select("id")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId)
            .in("status", ["pending", "confirmed"])
            .lt("starts_at", new Date(endMs).toISOString())
            .gt("ends_at", new Date(startMs).toISOString());

          const existingBookings = ((conflicts as unknown[]) ?? []).length;

          const staffName = staff.display_name ?? staff.name ?? null;
          const payload: BlockPayload = {
            staffName,
            fromHuman: formatDateHuman(input.startIso, tenantTimezone),
            toHuman: formatDateHuman(input.endIso, tenantTimezone),
            type: input.type,
            reason: input.reason ?? null,
            existingBookings,
          };

          if (!input.confirm) {
            const warn =
              existingBookings > 0
                ? `\n⚠️ Aviso: ya hay ${existingBookings} cita(s) en ese rango — NO se cancelarán, solo se bloquean huecos nuevos.`
                : "";
            return preview(
              `Bloquear tiempo de **${staffName ?? "staff"}** del ${payload.fromHuman} al ${payload.toHuman} (motivo: ${input.type}${input.reason ? ` — ${input.reason}` : ""}).${warn}\n¿Lo creo?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: created, error: insErr } = await (
            supabase.from("staff_blockings") as any
          )
            .insert({
              tenant_id: ctx.tenantId,
              staff_id: input.staffId,
              start_at: new Date(startMs).toISOString(),
              end_at: new Date(endMs).toISOString(),
              type: input.type,
              reason: input.reason ?? null,
              created_by: ctx.userId,
            })
            .select("id")
            .single();

          if (insErr) return err(`No se pudo bloquear: ${insErr.message}`);

          return ok<BlockPayload>(
            `Bloqueado — ${staffName ?? "staff"} del ${payload.fromHuman} al ${payload.toHuman}.`,
            { ...payload, blockingId: (created as { id: string }).id },
          );
        },
      );
    },
  });
}
