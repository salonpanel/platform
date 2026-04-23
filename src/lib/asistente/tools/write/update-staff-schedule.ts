/**
 * Tool: update_staff_schedule
 *
 * Sustituye el horario recurrente (staff_schedules) por un conjunto nuevo:
 * misma semántica que el RPC del panel (borrar todo e insertar franjas).
 * dayOfWeek: 0=domingo … 6=sábado, como get_staff_schedule.
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

const DAY_NAMES = [
  "dom",
  "lun",
  "mar",
  "mié",
  "jue",
  "vie",
  "sáb",
] as const;

function toPgTime(s: string): string {
  const t = s.trim();
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    return t;
  }
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    return `${t}:00`;
  }
  return t;
}

const SlotSchema = z.object({
  dayOfWeek: z
    .number()
    .int()
    .min(0)
    .max(6)
    .describe("0=domingo, 1=lunes, …, 6=sábado"),
  startTime: z
    .string()
    .regex(
      /^\d{1,2}:\d{2}$/,
      "Hora inicio en formato HH:MM (ej. 09:00).",
    ),
  endTime: z
    .string()
    .regex(
      /^\d{1,2}:\d{2}$/,
      "Hora fin en formato HH:MM (ej. 18:00).",
    ),
  isActive: z.boolean().default(true),
});

const InputSchema = z.object({
  staffId: z.string().uuid(),
  /** Lista completa: reemplaza el horario previo. Puede ser vacía (limpiar). */
  slots: z.array(SlotSchema).max(100),
  confirm: z.boolean().default(false),
});

interface Payload {
  staffName: string;
  slotCount: number;
  descriptionLines: string[];
}

function describeSlots(
  slots: z.infer<typeof SlotSchema>[],
  max = 6,
): string[] {
  const lines = slots.map(
    (s) =>
      `${DAY_NAMES[s.dayOfWeek] ?? "?"}. ${s.startTime}–${s.endTime}${
        s.isActive ? "" : " (inactiva)"
      }`,
  );
  if (lines.length <= max) {
    return lines;
  }
  return [...lines.slice(0, max), `… y ${lines.length - max} más`];
}

export function buildUpdateStaffScheduleTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Reemplaza el horario semanal recurrente de un profesional. Pasas la lista de franjas (día 0=domingo, hora inicio/fin en 24h). Sustituye el horario anterior por completo; slots vacío borra el horario. Requiere manager+; preview → confirm. Para leer el actual usa get_staff_schedule.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_staff_schedule",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("cambiar el horario fijo de personal", ctx.userRole);
          }

          const toMin = (t: string) => {
            const [h, m] = t.split(":").map((x) => parseInt(x, 10));
            return h * 60 + (m || 0);
          };
          for (const s of input.slots) {
            if (toMin(s.endTime) <= toMin(s.startTime)) {
              return err(
                `Franja inválida el ${DAY_NAMES[s.dayOfWeek]}: la hora de fin debe ser posterior al inicio.`,
              );
            }
          }

          const supabase = getSupabaseAdmin();
          const { data: st } = await supabase
            .from("staff")
            .select("id, name, display_name")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();
          if (!st) {
            return err("Profesional no encontrado.");
          }
          const sRow = st as { display_name: string | null; name: string | null };
          const staffName = (sRow.display_name ?? sRow.name ?? "Staff").trim();

          const descriptionLines = describeSlots(input.slots);
          const base: Payload = {
            staffName,
            slotCount: input.slots.length,
            descriptionLines,
          };

          if (!input.confirm) {
            if (input.slots.length === 0) {
              return preview(
                `Vas a **borrar todo el horario** recurrente de **${staffName}** (quedará sin franjas). ¿Confirmas?`,
                base,
                "Borrar horario semanal.",
              );
            }
            return preview(
              `Nuevo horario para **${staffName}** (${input.slots.length} franja(s)):\n` +
                descriptionLines.map((l) => `- ${l}`).join("\n") +
                "\n\n¿Sustituyo el horario anterior por éste?",
              base,
              "Listo para actualizar el horario recurrente.",
            );
          }

          const { error: delE } = await (supabase.from("staff_schedules") as any)
            .delete()
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId);
          if (delE) {
            return err("No se pudo limpiar el horario previo.");
          }

          if (input.slots.length > 0) {
            const rows = input.slots.map((s) => ({
              tenant_id: ctx.tenantId,
              staff_id: input.staffId,
              day_of_week: s.dayOfWeek,
              start_time: toPgTime(s.startTime),
              end_time: toPgTime(s.endTime),
              is_active: s.isActive,
            }));
            const { error: insE } = await (supabase.from("staff_schedules") as any)
              .insert(rows);
            if (insE) {
              return err("No se pudo guardar el horario: revisa traslapes o formato de hora.");
            }
          }

          await (supabase.from("staff") as any)
            .update({ updated_at: new Date().toISOString() })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId);

          return ok<Payload>(
            input.slots.length === 0
              ? `Horario recurrente de **${staffName}** borrado.`
              : `Horario de **${staffName}** actualizado (${input.slots.length} franja(s)).`,
            base,
          );
        },
      );
    },
  });
}
