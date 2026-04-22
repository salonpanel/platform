/**
 * Tool: get_staff_schedule
 *
 * Devuelve el horario semanal recurrente de un profesional — qué días
 * trabaja y en qué franjas. Base para responder "¿qué hace María los
 * viernes?" o "¿a qué hora entra Carlos?".
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  staffId: z.string().uuid(),
  includeInactive: z.boolean().default(false),
});

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

interface ScheduleSlot {
  dayOfWeek: number;
  dayName: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isActive: boolean;
}

interface SchedulePayload {
  staffId: string;
  staffName: string | null;
  count: number;
  slots: ScheduleSlot[];
}

/** Recorta HH:MM:SS → HH:MM. */
function trimTime(t: string): string {
  return t.slice(0, 5);
}

export function buildGetStaffScheduleTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Horario semanal recurrente de un profesional (qué días y en qué franjas trabaja). Útil para '¿a qué hora entra María?', '¿trabaja Juan los sábados?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<SchedulePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_staff_schedule",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const { data: staffRow } = await supabase
            .from("staff")
            .select("id, name, display_name")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();
          const staff = staffRow as {
            id: string;
            name: string | null;
            display_name: string | null;
          } | null;
          if (!staff) return err("Profesional no encontrado.");

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("staff_schedules")
            .select("day_of_week, start_time, end_time, is_active")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });

          if (!input.includeInactive) query = query.eq("is_active", true);

          const { data, error } = await query;
          if (error) return err("No se pudo consultar el horario.");

          const rows =
            ((data as unknown) as Array<{
              day_of_week: number;
              start_time: string;
              end_time: string;
              is_active: boolean | null;
            }>) ?? [];

          const slots: ScheduleSlot[] = rows.map((r) => ({
            dayOfWeek: r.day_of_week,
            dayName: DAY_NAMES[r.day_of_week] ?? `día ${r.day_of_week}`,
            startTime: trimTime(r.start_time),
            endTime: trimTime(r.end_time),
            isActive: !!r.is_active,
          }));

          const staffName = staff.display_name ?? staff.name ?? null;
          const summary =
            slots.length === 0
              ? `${staffName ?? "El profesional"} no tiene horario configurado.`
              : `Horario de ${staffName ?? "staff"} — ${slots.length} franja(s).`;

          return ok<SchedulePayload>(summary, {
            staffId: staff.id,
            staffName,
            count: slots.length,
            slots,
          });
        },
      );
    },
  });
}
