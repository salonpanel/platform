/**
 * Tool: clone_service
 *
 * Duplica un servicio del catálogo con nombre nuevo, mismos importes y
 * reglas. Stripe price/product se limpian (el nuevo se enlaza luego al panel).
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
  sourceServiceId: z.string().uuid().describe("ID del servicio a copiar (list_services)."),
  newName: z.string().min(2).max(120).describe("Nombre del nuevo servicio (debe ser distintivo)."),
  confirm: z.boolean().default(false),
});

interface Payload {
  newName: string;
  fromName: string;
  priceEur: string;
  durationMin: number;
  newServiceId?: string;
}

export function buildCloneServiceTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Crea un servicio nuevo copiando precio, duración, buffer, categoría, descripción y opciones de depósito de uno existente. Requiere manager+; preview → confirm. Tras clonar, enlaza producto Stripe en el panel si aplica.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "clone_service",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("clonar servicios", ctx.userRole);
          }

          const name = input.newName.trim();
          const supabase = getSupabaseAdmin();
          const { data: src, error: fErr } = await (supabase.from("services") as any)
            .select(
              "id, name, price_cents, duration_min, buffer_min, category, description, deposit_enabled, deposit_type, deposit_amount, deposit_percent, online_payment_required, pricing_levels",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.sourceServiceId)
            .maybeSingle();

          if (fErr || !src) {
            return err("Servicio origen no encontrado.");
          }

          const s = src as {
            name: string;
            price_cents: number;
            duration_min: number;
            buffer_min: number;
            category: string;
            description: string | null;
            deposit_enabled: boolean | null;
            deposit_type: string | null;
            deposit_amount: number | string | null;
            deposit_percent: number | string | null;
            online_payment_required: boolean | null;
            pricing_levels: unknown;
          };

          const base: Payload = {
            newName: name,
            fromName: s.name,
            priceEur: centsToEur(s.price_cents),
            durationMin: s.duration_min,
          };

          if (!input.confirm) {
            return preview(
              `Se creará un servicio **${name}** como copia de **${s.name}** — ${base.priceEur}, ${s.duration_min} min, buffer ${s.buffer_min} min, categoría "${s.category}". ¿Lo creo?`,
              base,
            );
          }

          const { data: ins, error: insE } = await (supabase.from("services") as any)
            .insert({
              tenant_id: ctx.tenantId,
              name,
              price_cents: s.price_cents,
              duration_min: s.duration_min,
              buffer_min: s.buffer_min,
              category: s.category,
              description: s.description,
              active: true,
              stripe_price_id: null,
              stripe_product_id: null,
              pricing_levels: s.pricing_levels,
              deposit_enabled: s.deposit_enabled ?? false,
              deposit_type: s.deposit_type,
              deposit_amount: s.deposit_amount,
              deposit_percent: s.deposit_percent,
              online_payment_required: s.online_payment_required ?? false,
            })
            .select("id")
            .single();

          if (insE || !ins) {
            return err("No se pudo crear el servicio clonado.");
          }

          return ok<Payload>(
            `Servicio **${name}** creado (copia de **${s.name}**). Revisa en el panel el enlace con Stripe si cobráis online.`,
            { ...base, newServiceId: (ins as { id: string }).id },
          );
        },
      );
    },
  });
}
