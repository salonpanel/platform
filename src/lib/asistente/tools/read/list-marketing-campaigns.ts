/**
 * Tool: list_marketing_campaigns
 *
 * Historial de campañas de email del negocio (tabla marketing_campaigns).
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
  limit: z.number().int().min(1).max(50).default(20),
});

export interface MarketingCampaignListItem {
  /** Para encadenar get_campaign_stats; no leer al usuario en voz alta. */
  campaignId: string;
  name: string;
  subject: string;
  status: string;
  sentAtHuman: string | null;
  targetCount: number | null;
  sentCount: number | null;
  failedCount: number | null;
}

interface ListPayload {
  count: number;
  campaigns: MarketingCampaignListItem[];
}

export function buildListMarketingCampaignsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista las campañas de email de marketing enviadas recientemente (nombre, asunto, estado, enviados/fallidos). Úsala para '¿qué campañas hemos mandado?' o para elegir una antes de ver detalle con get_campaign_stats.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_marketing_campaigns",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await (supabase.from("marketing_campaigns") as any)
            .select(
              "id, name, subject, status, target_client_count, sent_count, failed_count, sent_at, created_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .order("created_at", { ascending: false })
            .limit(input.limit);

          if (error) {
            return err("No pude leer el historial de campañas.");
          }

          const rows =
            (data as unknown as Array<{
              id: string;
              name: string;
              subject: string;
              status: string;
              target_client_count: number | null;
              sent_count: number | null;
              failed_count: number | null;
              sent_at: string | null;
              created_at: string;
            }>) ?? [];

          const campaigns: MarketingCampaignListItem[] = rows.map((r) => {
            const when = r.sent_at ?? r.created_at;
            return {
              campaignId: r.id,
              name: r.name,
              subject: r.subject,
              status: r.status,
              sentAtHuman: when
                ? formatDateHuman(when, tenantTimezone)
                : null,
              targetCount: r.target_client_count,
              sentCount: r.sent_count,
              failedCount: r.failed_count,
            };
          });

          const n = campaigns.length;
          return ok<ListPayload>(
            n === 0
              ? "No hay campañas registradas todavía."
              : `Tienes ${n} campaña${n === 1 ? "" : "s"} en el historial.`,
            { count: n, campaigns },
          );
        },
      );
    },
  });
}
