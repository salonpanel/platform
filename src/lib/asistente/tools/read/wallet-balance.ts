/**
 * Tool: get_wallet_balance
 *
 * Balance en Stripe Connect (disponible / pendiente), misma lógica que
 * GET /api/payments/wallet/balance.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import { ok, err, withAudit, hasRoleAtLeast, denyByRole, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({});

interface BalancePayload {
  availableEur: string;
  pendingEur: string;
  currency: string;
  /** Resumen de bloques (igual enfoque que la API) */
  availableCount: number;
  pendingCount: number;
}

export function buildGetWalletBalanceTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Saldo de la cartera en Stripe (dinero pendiente y disponible para retirar a banco) de este negocio. Requiere manager u owner; necesita Stripe conectado.",
    inputSchema: InputSchema,
    execute: async (): Promise<ToolOutput<BalancePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_wallet_balance",
          toolCategory: "READ_HIGH",
          toolInput: null,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("ver el saldo de la cartera Stripe", ctx.userRole);
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
            return err("Stripe no está vinculado; conecta la cuenta en Ajustes / Pagos.");
          }

          try {
            const stripe = getStripeClient();
            const balance = await stripe.balance.retrieve({
              stripeAccount: acct,
            });
            const available =
              balance.available.reduce((s, it) => s + it.amount, 0) / 100;
            const pending =
              balance.pending.reduce((s, it) => s + it.amount, 0) / 100;
            const fmt = (n: number) =>
              n.toLocaleString("es-ES", {
                style: "currency",
                currency: (balance.available[0]?.currency ?? "eur").toUpperCase(),
              });
            return ok<BalancePayload>(
              `Disponible **${fmt(available)}** · pendiente **${fmt(pending)}**.`,
              {
                availableEur: fmt(available),
                pendingEur: fmt(pending),
                currency: balance.available[0]?.currency ?? "eur",
                availableCount: balance.available.length,
                pendingCount: balance.pending.length,
              },
            );
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("STRIPE_SECRET_KEY")) {
              return err("Servicio de pagos no configurado en el servidor.");
            }
            return err("No se pudo leer el saldo de Stripe.");
          }
        },
      );
    },
  });
}
