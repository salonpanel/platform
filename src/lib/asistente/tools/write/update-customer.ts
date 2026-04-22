/**
 * Tool: update_customer
 *
 * Actualiza campos básicos de un cliente.
 *
 * RBAC: staff puede editar cualquier cliente (ya están dentro del negocio).
 * admin/manager también. Para banned / tags sensibles → manager+.
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
  customerId: z.string().uuid(),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(4).max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  marketingOptIn: z.boolean().optional(),
  isVip: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  confirm: z.boolean().default(false),
});

interface UpdatePayload {
  customerId: string;
  changes: string[];
}

export function buildUpdateCustomerTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Actualiza datos de un cliente existente. Pasa solo los campos a cambiar. Marcar como banned o VIP requiere rol manager o superior. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<UpdatePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "update_customer",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const wantsSensitive =
            input.isBanned !== undefined || input.isVip !== undefined;
          if (wantsSensitive && !hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("marcar VIP/baneado", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: current, error: fetchErr } = await supabase
            .from("customers")
            .select(
              "id, name, full_name, email, phone, notes, marketing_opt_in, is_vip, is_banned",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.customerId)
            .maybeSingle();

          if (fetchErr || !current) return err("Cliente no encontrado.");

          const before = current as {
            id: string;
            name: string | null;
            full_name: string | null;
            email: string | null;
            phone: string | null;
            notes: string | null;
            marketing_opt_in: boolean;
            is_vip: boolean;
            is_banned: boolean;
          };

          const changes: string[] = [];
          const patch: Record<string, unknown> = {};

          if (
            input.fullName !== undefined &&
            input.fullName.trim() !== (before.full_name ?? before.name ?? "")
          ) {
            const v = input.fullName.trim();
            patch.name = v;
            patch.full_name = v;
            changes.push(
              `nombre: "${before.full_name ?? before.name ?? ""}" → "${v}"`,
            );
          }
          if (input.email !== undefined) {
            const v = input.email ? input.email.trim().toLowerCase() : null;
            if (v !== (before.email ?? null)) {
              patch.email = v;
              changes.push(`email: ${before.email ?? "—"} → ${v ?? "—"}`);
            }
          }
          if (input.phone !== undefined) {
            const v = input.phone ? input.phone.trim() : null;
            if (v !== (before.phone ?? null)) {
              patch.phone = v;
              changes.push(`teléfono: ${before.phone ?? "—"} → ${v ?? "—"}`);
            }
          }
          if (
            input.notes !== undefined &&
            (input.notes ?? null) !== (before.notes ?? null)
          ) {
            patch.notes = input.notes;
            changes.push("notas actualizadas");
          }
          if (
            input.marketingOptIn !== undefined &&
            input.marketingOptIn !== before.marketing_opt_in
          ) {
            patch.marketing_opt_in = input.marketingOptIn;
            changes.push(
              `marketing: ${before.marketing_opt_in ? "sí" : "no"} → ${input.marketingOptIn ? "sí" : "no"}`,
            );
          }
          if (input.isVip !== undefined && input.isVip !== before.is_vip) {
            patch.is_vip = input.isVip;
            changes.push(`VIP: ${before.is_vip ? "sí" : "no"} → ${input.isVip ? "sí" : "no"}`);
          }
          if (
            input.isBanned !== undefined &&
            input.isBanned !== before.is_banned
          ) {
            patch.is_banned = input.isBanned;
            changes.push(
              `baneado: ${before.is_banned ? "sí" : "no"} → ${input.isBanned ? "sí" : "no"}`,
            );
          }

          if (changes.length === 0) {
            return err("No hay cambios respecto al estado actual.");
          }

          const displayName = before.full_name ?? before.name ?? "cliente";
          const payload: UpdatePayload = {
            customerId: before.id,
            changes,
          };

          if (!input.confirm) {
            return preview(
              `Cambios en **${displayName}**:\n- ${changes.join("\n- ")}\n¿Lo aplico?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("customers") as any)
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.customerId);

          if (updErr) return err(`No se pudo actualizar: ${updErr.message}`);

          return ok<UpdatePayload>(
            `Actualizado **${displayName}**: ${changes.join(", ")}.`,
            payload,
          );
        },
      );
    },
  });
}
