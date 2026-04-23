/**
 * Tool: get_campaign_stats
 *
 * Detalle y métricas de una fila concreta de marketing_campaigns.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  formatDateHuman,
  ok,
  err,
  withAudit,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  campaignId: z.string().uuid().describe("ID de la campaña (viene de list_marketing_campaigns)."),
});

interface StatsPayload {
  name: string;
  subject: string;
  status: string;
  sentAtHuman: string | null;
  targetCount: number | null;
  sentCount: number | null;
  failedCount: number | null;
  /** true si se guardó cuerpo en DB */
  hasBodyStored: boolean;
}

export function buildGetCampaignStatsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Obtiene el detalle y las cifras de UNA campaña de marketing (enviados, fallos, destinatarios previstos, estado). Pasa el campaignId obtenido de list_marketing_campaigns.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<StatsPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_campaign_stats",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await (supabase.from("marketing_campaigns") as any)
            .select(
              "id, name, subject, body_html, status, target_client_count, sent_count, failed_count, sent_at, created_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.campaignId)
            .maybeSingle();

          if (error) {
            return err("No pude leer la campaña.");
          }
          if (!data) {
            return err("Campaña no encontrada o no pertenece a tu negocio.");
          }

          const row = data as {
            name: string;
            subject: string;
            body_html: string | null;
            status: string;
            target_client_count: number | null;
            sent_count: number | null;
            failed_count: number | null;
            sent_at: string | null;
            created_at: string;
          };

          const when = row.sent_at ?? row.created_at;
          const sent = row.sent_count ?? 0;
          const failed = row.failed_count ?? 0;
          const target = row.target_client_count;

          return ok<StatsPayload>(
            `Campaña «${row.name}»: **${row.status}** — enviados **${sent}**` +
              (failed > 0 ? `, fallidos **${failed}**` : "") +
              (target != null ? `, previstos **${target}**` : "") +
              ".",
            {
              name: row.name,
              subject: row.subject,
              status: row.status,
              sentAtHuman: when
                ? formatDateHuman(when, tenantTimezone)
                : null,
              targetCount: target,
              sentCount: row.sent_count,
              failedCount: row.failed_count,
              hasBodyStored: Boolean(row.body_html && row.body_html.length > 0),
            },
          );
        },
      );
    },
  });
}
