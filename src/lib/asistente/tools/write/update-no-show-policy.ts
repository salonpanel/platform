/**
 * Tool: update_no_show_policy
 *
 * Misma lógica que Ajustes → no-show: columnas en tenant_settings.
 * Panel: solo owner/admin; aquí mismo criterio.
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
    noShowProtectionEnabled: z.boolean().optional(),
    noShowMode: z
      .enum(["deposit", "cancellation"])
      .optional()
      .describe('Política: depósito o penalti por ventana de cancelación. Igual que el panel: "deposit" o "cancellation".'),
    noShowProtectionPercentage: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Porcentaje de depósito o retención (0–100)."),
    noShowCancellationHours: z
      .number()
      .int()
      .min(0)
      .max(168)
      .optional()
      .describe("Horas de preaviso para el modo cancellation."),
    confirm: z.boolean().default(false),
  })
  .describe("Pasa al menos un campo; solo los presentes se actualizan.");

interface Payload {
  changes: string[];
}

export function buildUpdateNoShowPolicyTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Configura la protección de no-shows: activar/desactivar, modo depósito o por cancelación, porcentaje y horas. Equivale a Ajustes → no-shows. Requiere owner o admin; preview → confirm. Antes de cambiar, get_tenant_info para ver el estado actual.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_no_show_policy",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "admin")) {
            return denyByRole("cambiar la política de no-shows", ctx.userRole);
          }

          const hasAny =
            input.noShowProtectionEnabled !== undefined ||
            input.noShowMode !== undefined ||
            input.noShowProtectionPercentage !== undefined ||
            input.noShowCancellationHours !== undefined;
          if (!hasAny) {
            return err("Indica al menos un parámetro (activo, modo, % o horas).");
          }

          const supabase = getSupabaseAdmin();
          const { data: cur, error: fErr } = await supabase
            .from("tenant_settings")
            .select(
              "no_show_protection_enabled, no_show_protection_mode, no_show_protection_percentage, no_show_cancellation_hours",
            )
            .eq("tenant_id", ctx.tenantId)
            .maybeSingle();

          if (fErr || !cur) {
            return err(
              "No hay ajustes guardados del negocio. Configúralo primero en el panel o crea el bloque de ajustes.",
            );
          }

          const t = cur as {
            no_show_protection_enabled: boolean | null;
            no_show_protection_mode: string | null;
            no_show_protection_percentage: number | null;
            no_show_cancellation_hours: number | null;
          };

          const changes: string[] = [];
          const patch: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (input.noShowProtectionEnabled !== undefined) {
            if (t.no_show_protection_enabled !== input.noShowProtectionEnabled) {
              changes.push(
                `protección no-show: ${t.no_show_protection_enabled ? "sí" : "no"} → ${input.noShowProtectionEnabled ? "sí" : "no"}`,
              );
            }
            patch.no_show_protection_enabled = input.noShowProtectionEnabled;
          }
          if (input.noShowMode !== undefined) {
            if (t.no_show_protection_mode !== input.noShowMode) {
              changes.push(
                `modo: ${t.no_show_protection_mode ?? "—"} → ${input.noShowMode}`,
              );
            }
            patch.no_show_protection_mode = input.noShowMode;
          }
          if (input.noShowProtectionPercentage !== undefined) {
            if (t.no_show_protection_percentage !== input.noShowProtectionPercentage) {
              changes.push(
                `porcentaje: ${t.no_show_protection_percentage ?? "—"}% → ${input.noShowProtectionPercentage}%`,
              );
            }
            patch.no_show_protection_percentage = input.noShowProtectionPercentage;
          }
          if (input.noShowCancellationHours !== undefined) {
            if (t.no_show_cancellation_hours !== input.noShowCancellationHours) {
              changes.push(
                `horas (modo cancelación): ${t.no_show_cancellation_hours ?? "—"}h → ${input.noShowCancellationHours}h`,
              );
            }
            patch.no_show_cancellation_hours = input.noShowCancellationHours;
          }

          if (changes.length === 0) {
            return err("Los valores son iguales a los actuales — nada que cambiar.");
          }

          const payload: Payload = { changes };
          if (!input.confirm) {
            return preview(
              "Cambios en política de no-shows:\n" +
                changes.map((c) => `- ${c}`).join("\n") +
                "\n\n¿Aplico?",
              payload,
              "Listo para actualizar no-shows.",
            );
          }

          const { error: uErr } = await (supabase.from("tenant_settings") as any)
            .update(patch)
            .eq("tenant_id", ctx.tenantId);

          if (uErr) {
            return err("No se pudo guardar la política de no-shows.");
          }

          return ok<Payload>(`Listo: ${changes.length} ajuste(s) en protección de no-shows.`, {
            changes,
          });
        },
      );
    },
  });
}
