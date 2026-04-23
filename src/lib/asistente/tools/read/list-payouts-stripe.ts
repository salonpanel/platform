/**
 * Tool: list_payouts
 *
 * Payouts a banco desde Stripe (movimientos de liquidación), no la tabla
 * `payments` del panel.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import {
  formatDateHuman,
  formatEur,
  ok,
  err,
  withAudit,
  hasRoleAtLeast,
  denyByRole,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  limit: z.number().int().min(1).max(30).default(10),
});

export interface PayoutItem {
  whenHuman: string;
  amountEur: string;
  status: string;
  arrivalHuman: string | null;
}

interface Payload {
  count: number;
  hasMore: boolean;
  items: PayoutItem[];
}

export function buildListPayoutsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista transferencias a banco (payouts) desde la cuenta Stripe Connect: importe, estado y fechas. No es el listado de cobros a clientes (para eso list_payments). Requiere manager+.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_payouts",
          toolCategory: "READ_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("ver los payouts a banco", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: tenant, error: tErr } = await supabase
            .from("tenants")
            .select("stripe_account_id")
            .eq("id", ctx.tenantId)
            .maybeSingle();
          if (tErr || !tenant) {
            return err("No se pudo leer el negocio.");
          }
          const acct = (tenant as { stripe_account_id: string | null })
            .stripe_account_id;
          if (!acct) {
            return err("Stripe no está vinculado; no hay historial de payouts.");
          }

          try {
            const stripe = getStripeClient();
            const res = await stripe.payouts.list(
              { limit: input.limit },
              { stripeAccount: acct },
            );

            const items: PayoutItem[] = res.data.map((p) => {
              const amountEur = formatEur(p.amount / 100);
              const createdIso = new Date(p.created * 1000).toISOString();
              const arr = p.arrival_date
                ? formatDateHuman(
                    new Date(p.arrival_date * 1000).toISOString(),
                    tenantTimezone,
                  )
                : null;
              return {
                whenHuman: formatDateHuman(createdIso, tenantTimezone),
                amountEur,
                status: p.status,
                arrivalHuman: arr,
              };
            });

            return ok<Payload>(
              items.length === 0
                ? "No hay payouts recientes con ese límite."
                : `**${items.length}** transferencia(s) a banco (último movimiento: ${items[0]?.whenHuman ?? "—"}).`,
              {
                count: items.length,
                hasMore: res.has_more,
                items,
              },
            );
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("STRIPE_SECRET_KEY")) {
              return err("Servicio de pagos no configurado en el servidor.");
            }
            return err("No se pudieron listar los payouts de Stripe.");
          }
        },
      );
    },
  });
}
