/**
 * Tool: create_service
 *
 * Crea un servicio nuevo. Dos pasadas:
 *   - Sin confirm → preview con lo que se creará.
 *   - confirm=true → INSERT real.
 *
 * RBAC: owner/admin/manager.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  centsToEur,
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
  name: z.string().min(2).max(120),
  priceEur: z
    .number()
    .min(0)
    .max(10000)
    .describe("Precio en euros (número, admite decimales)."),
  durationMin: z.number().int().min(5).max(480),
  category: z.string().max(60).optional(),
  bufferMin: z.number().int().min(0).max(120).default(0),
  description: z.string().max(1000).optional(),
  confirm: z
    .boolean()
    .default(false)
    .describe(
      "false = preview (dry-run); true = ejecutar. Empieza siempre en false.",
    ),
});

interface CreatePayload {
  serviceId?: string;
  name: string;
  priceEur: string;
  durationMin: number;
  category: string;
  bufferMin: number;
}

export function buildCreateServiceTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Crea un nuevo servicio del negocio. Requiere nombre, precio (€) y duración (min). Opcionalmente categoría y buffer. Flujo obligatorio: primero llamar SIN confirm para obtener preview, luego con confirm=true si el usuario acepta.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<CreatePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "create_service",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("crear servicios", ctx.userRole);
          }

          const priceCents = Math.round(input.priceEur * 100);
          const category = input.category?.trim() || "Otros";
          const payload: CreatePayload = {
            name: input.name.trim(),
            priceEur: centsToEur(priceCents),
            durationMin: input.durationMin,
            category,
            bufferMin: input.bufferMin,
          };

          if (!input.confirm) {
            return preview(
              `Crear servicio **${payload.name}** — ${payload.priceEur}, ${payload.durationMin} min${
                payload.bufferMin ? ` (+${payload.bufferMin} min buffer)` : ""
              }, categoría "${payload.category}". ¿Lo creo?`,
              payload,
            );
          }

          const supabase = getSupabaseAdmin();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase.from("services") as any)
            .insert({
              tenant_id: ctx.tenantId,
              name: payload.name,
              price_cents: priceCents,
              duration_min: payload.durationMin,
              buffer_min: payload.bufferMin,
              category,
              description: input.description ?? null,
              active: true,
            })
            .select("id")
            .single();

          if (error) {
            return err(`No se pudo crear el servicio: ${error.message}`);
          }

          const created = data as { id: string };
          return ok<CreatePayload>(
            `Servicio **${payload.name}** creado por ${payload.priceEur}.`,
            { ...payload, serviceId: created.id },
          );
        },
      );
    },
  });
}
