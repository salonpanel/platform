/**
 * Tool: update_staff
 *
 * Actualiza nombre, visibilidad, horas, color y bio. No toca horario semanal
 * (staff_schedules) ni asignación de servicios (usa assign_service_to_staff en
 * el futuro o el panel); reduce superficie de error.
 *
 * RBAC: manager+.
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
  name: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(120).optional(),
  weeklyHours: z.number().int().min(0).max(60).optional(),
  color: z.string().max(32).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  confirm: z.boolean().default(false),
});

interface UpdatePayload {
  name: string;
  displayName: string;
  changes: string[];
}

export function buildUpdateStaffTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Actualiza datos básicos de un miembro del staff (nombre, nombre visible, horas semanales, color, bio). No modifica el horario recurrente. Requiere manager+; preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<UpdatePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_staff",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("editar ficha de personal", ctx.userRole);
          }

          if (
            input.name === undefined &&
            input.displayName === undefined &&
            input.weeklyHours === undefined &&
            input.color === undefined &&
            input.bio === undefined
          ) {
            return err("Indica al menos un campo a cambiar.");
          }

          const supabase = getSupabaseAdmin();
          const { data: cur, error: fErr } = await supabase
            .from("staff")
            .select("id, name, display_name, weekly_hours, color, bio")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();

          if (fErr || !cur) {
            return err("Miembro no encontrado.");
          }

          const before = cur as {
            name: string;
            display_name: string;
            weekly_hours: number | null;
            color: string | null;
            bio: string | null;
          };

          const changes: string[] = [];
          const patch: Record<string, unknown> = {};

          if (input.name !== undefined && input.name.trim() !== before.name) {
            patch.name = input.name.trim();
            changes.push(
              `nombre interno: "${before.name}" → "${input.name.trim()}"`,
            );
          }
          if (
            input.displayName !== undefined &&
            input.displayName.trim() !==
              (before.display_name ?? before.name)
          ) {
            patch.display_name = input.displayName.trim();
            changes.push("nombre mostrado actualizado");
          }
          if (
            input.weeklyHours !== undefined &&
            input.weeklyHours !== (before.weekly_hours ?? 40)
          ) {
            patch.weekly_hours = input.weeklyHours;
            changes.push(
              `horas semanales: ${before.weekly_hours ?? 40} → ${input.weeklyHours}`,
            );
          }
          if (input.color !== undefined) {
            patch.color = input.color;
            changes.push("color");
          }
          if (input.bio !== undefined) {
            patch.bio = input.bio;
            changes.push("bio");
          }

          if (changes.length === 0) {
            return err("Nada que actualizar: los valores son iguales a los actuales.");
          }

          const displayName = before.display_name ?? before.name;
          const payload: UpdatePayload = {
            name: (patch.name as string) ?? before.name,
            displayName: (patch.display_name as string) ?? displayName,
            changes,
          };

          if (!input.confirm) {
            return preview(
              `Vas a actualizar a **${displayName}**:` +
                changes.map((c) => `\n- ${c}`).join("") +
                "\n\n¿Aplico los cambios?",
              payload,
              "Listo para actualizar ficha de staff.",
            );
          }

          patch.updated_at = new Date().toISOString();
          const { error: uErr } = await (supabase.from("staff") as any)
            .update(patch)
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId);

          if (uErr) {
            return err("No se pudo guardar los cambios.");
          }

          return ok<UpdatePayload>(`Cambios guardados para **${payload.displayName}**.`, {
            ...payload,
          });
        },
      );
    },
  });
}
