/**
 * Tool: update_business_hours
 *
 * Horario de apertura/cierre “genérico” en tenant_settings (misma fila que
 * usa get_tenant_info). Sustituye open/close; no toca el JSON business_hours
 * de tenants.
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

const InputSchema = z.object({
  businessOpenTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, "Hora apertura HH:MM (24h).")
    .describe("Apertura, ej. 09:00"),
  businessCloseTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, "Hora cierre HH:MM (24h).")
    .describe("Cierre, ej. 20:00"),
  confirm: z.boolean().default(false),
});

interface Payload {
  before: string;
  after: string;
}

export function buildUpdateBusinessHoursTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Cambia el horario base de apertura y cierre del negocio (referencia en reservas / panel). Requiere manager+; preview → confirm. No sustituye el horario semanal de cada empleado (eso es update_staff_schedule).",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_business_hours",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("cambiar el horario del negocio", ctx.userRole);
          }

          const toMin = (t: string) => {
            const [h, m] = t.split(":").map((x) => parseInt(x, 10));
            return h * 60 + (m || 0);
          };
          if (toMin(input.businessCloseTime) <= toMin(input.businessOpenTime)) {
            return err("El cierre debe ser posterior a la apertura (mismo día).");
          }

          const supabase = getSupabaseAdmin();
          const { data: cur, error: fErr } = await supabase
            .from("tenant_settings")
            .select("id, business_open_time, business_close_time")
            .eq("tenant_id", ctx.tenantId)
            .maybeSingle();

          if (fErr || !cur) {
            return err(
              "No hay fila de ajustes del negocio — configúrala primero en el panel (Ajustes).",
            );
          }

          const c = cur as {
            business_open_time: string | null;
            business_close_time: string | null;
          };
          const beforeOpen = c.business_open_time
            ? String(c.business_open_time).slice(0, 5)
            : "—";
          const beforeClose = c.business_close_time
            ? String(c.business_close_time).slice(0, 5)
            : "—";
          const before = `${beforeOpen}–${beforeClose}`;
          const after = `${input.businessOpenTime}–${input.businessCloseTime}`;

          if (!input.confirm) {
            return preview(
              `Horario de referencia: **${before}** → **${after}** (cierra/ abre a nivel negocio). ¿Lo aplico?`,
              { before, after },
              "Cambio de horario de apertura listo para confirmar.",
            );
          }

          const { error: uErr } = await (supabase.from("tenant_settings") as any)
            .update({
              business_open_time: toPgTime(input.businessOpenTime),
              business_close_time: toPgTime(input.businessCloseTime),
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId);

          if (uErr) {
            return err("No se pudo guardar el horario.");
          }

          return ok<Payload>(`Hecho: apertura **${after}** (referencia).`, {
            before,
            after,
          });
        },
      );
    },
  });
}
