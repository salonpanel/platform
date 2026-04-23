/**
 * Tool: send_message_to_customer
 *
 * Email a un solo cliente (mismo motor que campañas). Requiere manager+.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runMarketingEmailBroadcast } from "@/lib/marketing/email-broadcast";
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
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().min(1).max(60_000),
  confirm: z.boolean().default(false),
});

interface SendPayload {
  customerName: string;
  subject: string;
  hasEmail: boolean;
  sent?: number;
  failed?: number;
}

export function buildSendMessageToCustomerTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Envía un email HTML a un cliente concreto (una sola persona). Usa {{nombre}} y {{negocio}}. Requiere manager+; preview → confirm. Queda registrado como campaña de una sola persona en el historial.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<SendPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "send_message_to_customer",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("enviar emails a clientes", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: row, error: qErr } = await supabase
            .from("customers")
            .select("id, name, full_name, email")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.customerId)
            .maybeSingle();

          if (qErr || !row) {
            return err("Cliente no encontrado.");
          }

          const c = row as {
            id: string;
            name: string | null;
            full_name: string | null;
            email: string | null;
          };
          const customerName = (c.full_name ?? c.name ?? "Cliente").trim();
          const hasEmail = !!c.email && String(c.email).trim() !== "";

          const base: SendPayload = {
            customerName,
            subject: input.subject.trim(),
            hasEmail,
          };

          if (!hasEmail) {
            return err(
              "Este cliente no tiene email — no se puede enviar el mensaje.",
            );
          }

          if (!input.confirm) {
            return preview(
              `Vas a enviar un email a **${customerName}** con asunto «${base.subject}». ¿Lo envío?`,
              base,
              `Listo para enviar email a ${customerName}.`,
            );
          }

          const shortName = customerName.slice(0, 40);
          const result = await runMarketingEmailBroadcast({
            tenantId: ctx.tenantId,
            clientIds: [c.id],
            subject: input.subject.trim(),
            bodyHtml: input.bodyHtml,
            campaignName: `Mensaje 1:1 — ${shortName}`,
            persistCampaign: true,
          });

          if (!result.ok) {
            return err(result.error, result.hint);
          }

          const { data } = result;
          return ok<SendPayload>(
            data.sent > 0
              ? `Email enviado a **${customerName}**.`
              : `No se pudo entregar el email a **${customerName}**.`,
            {
              ...base,
              sent: data.sent,
              failed: data.failed,
            },
          );
        },
      );
    },
  });
}
