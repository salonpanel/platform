/**
 * Tool: deactivate_service
 *
 * Atajo para marcar un servicio como inactivo (no borra). Equivale a
 * update_service con active=false.
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
  centsToEur,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  serviceId: z.string().uuid(),
  confirm: z.boolean().default(false),
});

interface Payload {
  name: string;
  priceEur: string;
}

export function buildDeactivateServiceTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Desactiva un servicio del catálogo: deja de listarse en reservas pero conserva el historial. Requiere manager+; preview → confirm. Para reactivar usa update_service con active.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "deactivate_service",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("desactivar servicios", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: cur, error: fErr } = await supabase
            .from("services")
            .select("id, name, price_cents, active")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId)
            .maybeSingle();

          if (fErr || !cur) {
            return err("Servicio no encontrado.");
          }

          const row = cur as {
            id: string;
            name: string;
            price_cents: number;
            active: boolean;
          };

          if (!row.active) {
            return ok<Payload>(`**${row.name}** ya estaba desactivado.`, {
              name: row.name,
              priceEur: centsToEur(row.price_cents),
            });
          }

          const base: Payload = {
            name: row.name,
            priceEur: centsToEur(row.price_cents),
          };

          if (!input.confirm) {
            return preview(
              `Vas a **desactivar** el servicio **${row.name}** (${base.priceEur}). Dejará de ofrecerse al reservar. ¿Confirmas?`,
              base,
            );
          }

          const { error: uErr } = await (supabase.from("services") as any)
            .update({
              active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId);

          if (uErr) {
            return err("No se pudo desactivar el servicio.");
          }

          return ok<Payload>(`**${row.name}** quedó desactivado.`, base);
        },
      );
    },
  });
}
