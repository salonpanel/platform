/**
 * Tool: create_customer
 *
 * Da de alta un cliente nuevo. Requiere al menos nombre + (email o teléfono).
 *
 * RBAC: owner/admin/manager/staff (todos pueden dar de alta).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    email: z.string().email().optional(),
    phone: z
      .string()
      .min(4)
      .max(40)
      .optional()
      .describe("Teléfono con prefijo o nacional. El sistema no valida formato."),
    notes: z.string().max(1000).optional(),
    marketingOptIn: z.boolean().default(true),
    confirm: z.boolean().default(false),
  })
  .refine((v) => !!v.email || !!v.phone, {
    message: "Se necesita al menos email o teléfono.",
  });

interface CustomerCreatedPayload {
  customerId?: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  marketingOptIn: boolean;
}

export function buildCreateCustomerTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Crea un cliente nuevo. Requiere nombre + email o teléfono. Flujo: sin confirm → preview; con confirm=true → crea. Si ya existe un cliente con el mismo email/teléfono, bloquea y pide aclarar.",
    inputSchema: InputSchema,
    execute: async (
      input,
    ): Promise<ToolOutputWithPreview<CustomerCreatedPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "create_customer",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const fullName = input.fullName.trim();
          const email = input.email?.trim().toLowerCase() ?? null;
          const phone = input.phone?.trim() ?? null;

          // Buscar duplicados por email o teléfono.
          if (email || phone) {
            const conds: string[] = [];
            if (email) conds.push(`email.eq.${email}`);
            if (phone) conds.push(`phone.eq.${phone}`);
            const { data: dupes } = await supabase
              .from("customers")
              .select("id, name, full_name, email, phone")
              .eq("tenant_id", ctx.tenantId)
              .or(conds.join(","))
              .limit(3);
            const dupeArr = (dupes as Array<{
              id: string;
              name: string | null;
              full_name: string | null;
              email: string | null;
              phone: string | null;
            }>) ?? [];
            if (dupeArr.length > 0) {
              const list = dupeArr
                .map(
                  (d) =>
                    `• ${d.full_name ?? d.name ?? "(sin nombre)"} — ${d.email ?? d.phone ?? "?"}`,
                )
                .join("\n");
              return err(
                `Ya hay cliente(s) con ese email o teléfono:\n${list}`,
                "Confirma si es el mismo (y edítalo) o usa datos distintos.",
              );
            }
          }

          const payload: CustomerCreatedPayload = {
            fullName,
            email,
            phone,
            marketingOptIn: input.marketingOptIn,
          };

          if (!input.confirm) {
            return preview(
              `Crear cliente **${fullName}**${email ? ` · ${email}` : ""}${phone ? ` · ${phone}` : ""}${input.marketingOptIn ? "" : " (sin marketing)"}. ¿Lo doy de alta?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase.from("customers") as any)
            .insert({
              tenant_id: ctx.tenantId,
              name: fullName,
              full_name: fullName,
              email,
              phone,
              notes: input.notes ?? null,
              marketing_opt_in: input.marketingOptIn,
            })
            .select("id")
            .single();

          if (error) return err(`No se pudo crear el cliente: ${error.message}`);

          const created = data as { id: string };
          return ok<CustomerCreatedPayload>(
            `Cliente **${fullName}** dado de alta.`,
            { ...payload, customerId: created.id },
          );
        },
      );
    },
  });
}
