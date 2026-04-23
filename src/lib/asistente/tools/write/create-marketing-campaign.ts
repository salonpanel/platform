/**
 * Tool: create_marketing_campaign
 *
 * Envía campaña de email a varios clientes (Resend) y registra en
 * marketing_campaigns. Requiere rol manager o superior.
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
  toHumanList,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  campaignName: z.string().min(2).max(200),
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().min(1).max(120_000),
  customerIds: z
    .array(z.string().uuid())
    .min(1)
    .max(200)
    .describe("IDs de clientes destino (p. ej. desde find_reactivation_candidates)."),
  confirm: z.boolean().default(false),
});

interface CampaignPayload {
  campaignName: string;
  subject: string;
  recipientCount: number;
  sampleNames: string[];
  skippedCount: number;
  sent?: number;
  failed?: number;
}

export function buildCreateMarketingCampaignTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Crea y envía una campaña de email HTML a una lista de clientes. Usa {{nombre}} y {{negocio}} en el HTML. Requiere manager+; flujo preview → confirm=true. Tras enviar queda registrada en el historial de campañas.",
    inputSchema: InputSchema,
    execute: async (
      input,
    ): Promise<ToolOutputWithPreview<CampaignPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "create_marketing_campaign",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("enviar campañas de marketing por email", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const idSet = [...new Set(input.customerIds)];
          const { data: rows, error: qErr } = await (supabase.from("customers") as any)
            .select("id, name, full_name, email")
            .eq("tenant_id", ctx.tenantId)
            .in("id", idSet);

          if (qErr) {
            return err("No se pudieron cargar los clientes.");
          }

          const list =
            (rows as unknown as Array<{
              id: string;
              name: string | null;
              full_name: string | null;
              email: string | null;
            }>) ?? [];

          const withEmail = list.filter(
            (c) => c.email && String(c.email).trim() !== "",
          );
          const skippedCount = idSet.length - withEmail.length;

          if (withEmail.length === 0) {
            return err(
              "Ninguno de los clientes indicados tiene email — no se puede enviar.",
            );
          }

          const displayName = (c: (typeof list)[0]) =>
            (c.full_name ?? c.name ?? "Sin nombre").trim();

          const sampleNames = withEmail.slice(0, 5).map(displayName);
          const extra = withEmail.length > 5 ? ` y ${withEmail.length - 5} más` : "";

          const base: CampaignPayload = {
            campaignName: input.campaignName.trim(),
            subject: input.subject.trim(),
            recipientCount: withEmail.length,
            sampleNames,
            skippedCount,
          };

          if (!input.confirm) {
            return preview(
              `Vas a enviar la campaña «${base.campaignName}» con asunto «${base.subject}» a **${base.recipientCount}** contacto(s) con email (${toHumanList(sampleNames)}${extra}).` +
                (skippedCount > 0
                  ? ` ${skippedCount} destinatario(s) se omiten (sin email o no encontrados).`
                  : "") +
                ` ¿Lo envío?`,
              { ...base },
              `Listo para enviar «${base.campaignName}» a ${base.recipientCount} persona(s).`,
            );
          }

          const result = await runMarketingEmailBroadcast({
            tenantId: ctx.tenantId,
            clientIds: withEmail.map((c) => c.id),
            subject: input.subject.trim(),
            bodyHtml: input.bodyHtml,
            campaignName: input.campaignName.trim(),
            persistCampaign: true,
          });

          if (!result.ok) {
            return err(result.error, result.hint);
          }

          const { data } = result;
          return ok<CampaignPayload>(
            `Campaña enviada: **${data.sent}** entregado(s)` +
              (data.failed > 0 ? `, **${data.failed}** fallido(s)` : "") +
              ".",
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
