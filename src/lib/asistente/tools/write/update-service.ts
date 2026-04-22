/**
 * Tool: update_service
 *
 * Actualiza campos básicos de un servicio (precio, duración, nombre,
 * buffer, categoría, activo). Campos ausentes = sin cambio.
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
  serviceId: z.string().uuid(),
  name: z.string().min(2).max(120).optional(),
  priceEur: z.number().min(0).max(10000).optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  bufferMin: z.number().int().min(0).max(120).optional(),
  category: z.string().max(60).optional(),
  active: z.boolean().optional(),
  description: z.string().max(1000).optional(),
  confirm: z.boolean().default(false),
});

interface UpdatePayload {
  serviceId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changes: string[];
}

export function buildUpdateServiceTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Actualiza un servicio existente. Solo modifica los campos que pases explícitamente. Flujo: sin confirm → preview con diff; con confirm=true → aplica.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<UpdatePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_service",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("editar servicios", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: current, error: fetchErr } = await supabase
            .from("services")
            .select(
              "id, name, price_cents, duration_min, buffer_min, category, active, description",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId)
            .maybeSingle();

          if (fetchErr || !current) {
            return err("Servicio no encontrado.");
          }

          const before = current as {
            id: string;
            name: string;
            price_cents: number;
            duration_min: number;
            buffer_min: number;
            category: string;
            active: boolean;
            description: string | null;
          };

          const changes: string[] = [];
          const patch: Record<string, unknown> = {};

          if (input.name !== undefined && input.name !== before.name) {
            patch.name = input.name.trim();
            changes.push(`nombre: "${before.name}" → "${patch.name}"`);
          }
          if (input.priceEur !== undefined) {
            const newCents = Math.round(input.priceEur * 100);
            if (newCents !== before.price_cents) {
              patch.price_cents = newCents;
              changes.push(
                `precio: ${centsToEur(before.price_cents)} → ${centsToEur(newCents)}`,
              );
            }
          }
          if (
            input.durationMin !== undefined &&
            input.durationMin !== before.duration_min
          ) {
            patch.duration_min = input.durationMin;
            changes.push(`duración: ${before.duration_min} min → ${input.durationMin} min`);
          }
          if (
            input.bufferMin !== undefined &&
            input.bufferMin !== before.buffer_min
          ) {
            patch.buffer_min = input.bufferMin;
            changes.push(`buffer: ${before.buffer_min} → ${input.bufferMin} min`);
          }
          if (
            input.category !== undefined &&
            input.category.trim() &&
            input.category.trim() !== before.category
          ) {
            patch.category = input.category.trim();
            changes.push(`categoría: "${before.category}" → "${patch.category}"`);
          }
          if (input.active !== undefined && input.active !== before.active) {
            patch.active = input.active;
            changes.push(
              `estado: ${before.active ? "activo" : "inactivo"} → ${input.active ? "activo" : "inactivo"}`,
            );
          }
          if (
            input.description !== undefined &&
            input.description !== (before.description ?? "")
          ) {
            patch.description = input.description;
            changes.push("descripción actualizada");
          }

          if (changes.length === 0) {
            return err(
              "No hay cambios respecto al estado actual.",
              "Indica al menos un campo distinto al valor actual.",
            );
          }

          const payload: UpdatePayload = {
            serviceId: before.id,
            before,
            after: { ...before, ...patch },
            changes,
          };

          if (!input.confirm) {
            return preview(
              `Cambios en **${before.name}**:\n- ${changes.join("\n- ")}\n¿Lo aplico?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("services") as any)
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId);

          if (updErr) return err(`No se pudo actualizar: ${updErr.message}`);

          return ok<UpdatePayload>(
            `Actualizado **${before.name}**: ${changes.join(", ")}.`,
            payload,
          );
        },
      );
    },
  });
}
