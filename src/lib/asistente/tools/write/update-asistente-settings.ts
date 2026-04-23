/**
 * Tool: update_asistente_settings
 *
 * Activa o desactiva el asistente y/o el modo de autonomía (tenants).
 * Destinado a owner/admin, equivalente a Ajustes → IA.
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

const InputSchema = z
  .object({
    asistenteEnabled: z
      .boolean()
      .optional()
      .describe("true = asistente habilitado para el negocio."),
    autonomyMode: z
      .enum(["supervised", "semi", "autonomous"])
      .optional()
      .describe("Cómo confirma acciones: supervisado, semi o autónomo."),
    confirm: z.boolean().default(false),
  })
  .describe("Al menos un campo requerido.");

interface Payload {
  changes: string[];
}

export function buildUpdateAsistenteSettingsTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Enciende o apaga BookFast AI para el negocio y/o cambia el modo de autonomía (supervised / semi / autonomous). Requiere owner o admin; preview → confirm. Uso con cuidado: deshabilitar corta el acceso al chat del asistente para todo el equipo.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_asistente_settings",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "admin")) {
            return denyByRole("cambiar ajustes del asistente a nivel negocio", ctx.userRole);
          }

          if (input.asistenteEnabled === undefined && input.autonomyMode === undefined) {
            return err("Indica asistenteEnabled y/o autonomyMode.");
          }

          const supabase = getSupabaseAdmin();
          const { data: t0, error: fErr } = await supabase
            .from("tenants")
            .select("asistente_enabled, asistente_autonomy_mode")
            .eq("id", ctx.tenantId)
            .maybeSingle();

          if (fErr || !t0) {
            return err("No se pudo leer el negocio.");
          }

          const t = t0 as {
            asistente_enabled: boolean | null;
            asistente_autonomy_mode: string | null;
          };

          const changes: string[] = [];
          const patch: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (input.asistenteEnabled !== undefined) {
            if (!!t.asistente_enabled !== input.asistenteEnabled) {
              changes.push(
                `asistente ${t.asistente_enabled ? "activo" : "inactivo"} → ${input.asistenteEnabled ? "activo" : "inactivo"}`,
              );
            }
            patch.asistente_enabled = input.asistenteEnabled;
          }
          if (input.autonomyMode !== undefined) {
            if (t.asistente_autonomy_mode !== input.autonomyMode) {
              changes.push(
                `modo autonomía: ${t.asistente_autonomy_mode ?? "—"} → ${input.autonomyMode}`,
              );
            }
            patch.asistente_autonomy_mode = input.autonomyMode;
          }

          if (changes.length === 0) {
            return err("Los valores son iguales a los actuales — nada que cambiar.");
          }

          const payload: Payload = { changes };

          if (!input.confirm) {
            return preview(
              "Cambios en ajustes del asistente:\n" +
                changes.map((c) => `- ${c}`).join("\n") +
                "\n\n¿Aplico?",
              payload,
              "Confirmar ajustes del asistente.",
            );
          }

          const { error: uErr } = await (supabase.from("tenants") as any)
            .update(patch)
            .eq("id", ctx.tenantId);

          if (uErr) {
            return err("No se pudieron guardar los ajustes.");
          }

          return ok<Payload>(`Ajustes del asistente actualizados (${changes.length} cambio(s)).`, {
            changes,
          });
        },
      );
    },
  });
}
