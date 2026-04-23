/**
 * Tool: set_staff_active
 *
 * Alta/baja lógica (activo = puede aparecer en agenda con normalidad). En DB
 * equivale a panel_manage_toggle_staff_active. Aquí vía admin + tenant.
 *
 * RBAC: alineado con toggles: owner y admin (el manager en panel no hace
 * bajas lógicas de otros).
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
  staffId: z.string().uuid(),
  active: z
    .boolean()
    .describe("true=activo en el equipo, false=baja lógica (invisible en agenda)."),
  confirm: z.boolean().default(false),
});

interface TogglePayload {
  name: string;
  willBeActive: boolean;
  wasActive: boolean;
}

export function buildSetStaffActiveTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Activa o desactiva lógicamente a un miembro (no lo borra). Requiere admin u owner. preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<TogglePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "set_staff_active",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "admin")) {
            return denyByRole("activar o desactivar personal", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: cur, error: fErr } = await supabase
            .from("staff")
            .select("id, name, display_name, active")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();

          if (fErr || !cur) {
            return err("Miembro no encontrado.");
          }

          const row = cur as {
            display_name: string | null;
            name: string;
            active: boolean | null;
          };
          const name = (row.display_name ?? row.name).trim();
          const wasActive = !!row.active;
          if (wasActive === input.active) {
            return err(
              `**${name}** ya ${input.active ? "está activo" : "está inactivo"}.`,
            );
          }

          const base: TogglePayload = {
            name,
            wasActive,
            willBeActive: input.active,
          };

          if (!input.confirm) {
            return preview(
              input.active
                ? `Vas a **reactivar** a **${name}** (volverá a mostrarse en agenda). ¿Confirmas?`
                : `Vas a **dar de baja lógica** a **${name}** (no se borra la ficha, deja de mostrarse como activa). ¿Confirmas?`,
              base,
              "Listo para cambiar el estado de actividad.",
            );
          }

          const { error: uErr } = await (supabase.from("staff") as any)
            .update({
              active: input.active,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId);

          if (uErr) {
            return err("No se pudo actualizar el estado.");
          }

          return ok<TogglePayload>(
            input.active
              ? `**${name}** vuelve a estar activo.`
              : `**${name}** quedó inactivo (baja lógica).`,
            { ...base },
          );
        },
      );
    },
  });
}
