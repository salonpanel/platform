/**
 * Tool: refund_payment
 *
 * Reembolso vía Stripe sobre el charge vinculado a una fila de `payments`.
 * El webhook charge.refunded actualiza el estado en BD.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe";
import { checkKillSwitch } from "../../security/kill-switch";
import {
  denyByRole,
  hasRoleAtLeast,
  ok,
  err,
  preview,
  withAudit,
  formatEur,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  paymentId: z.string().uuid().describe("ID de la fila en list_payments."),
  /** Si no se pasa, reembolso total. */
  amountEur: z
    .number()
    .positive()
    .max(100_000)
    .optional()
    .describe("Importe a devolver (parcial) en euros; omitir = total."),
  confirm: z.boolean().default(false),
});

interface RefundPayload {
  customerLabel: string;
  maxEur: string;
  refundEur: string;
  isPartial: boolean;
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) {
    return 0;
  }
  return typeof v === "string" ? parseFloat(v) : v;
}

export function buildRefundPaymentTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Inicia un reembolso en Stripe (total o parcial) para un pago listado. Requiere admin u owner, kill switch de refunds, y el pago debe estar en estado correcto. preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<RefundPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "refund_payment",
          toolCategory: "CRITICAL",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "admin")) {
            return denyByRole("procesar reembolsos con Stripe", ctx.userRole);
          }

          const ks = await checkKillSwitch({
            tenantId: ctx.tenantId,
            capability: "refunds",
          });
          if (!ks.allowed) {
            return err(
              "Los reembolsos desde el asistente están desactivados (kill switch o política del negocio).",
              "Hazlo desde el panel o pide a un admin que lo habilite.",
            );
          }

          const supabase = getSupabaseAdmin();
          const { data: row, error: qE } = await (supabase.from("payments") as any)
            .select(
              "id, amount, status, stripe_charge_id, customer_name, customer_email, tenant_id",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.paymentId)
            .maybeSingle();

          if (qE || !row) {
            return err("Pago no encontrado.");
          }

          const p = row as {
            id: string;
            amount: number | string | null;
            status: string;
            stripe_charge_id: string | null;
            customer_name: string | null;
            customer_email: string | null;
          };

          if (p.status !== "succeeded") {
            return err(
              `Solo se puede reembolsar un pago con estado "succeeded" (éste: ${p.status}).`,
            );
          }
          if (!p.stripe_charge_id) {
            return err("Este pago no tiene charge de Stripe vinculado; no se puede reembolsar aquí.");
          }

          const maxEur = toNum(p.amount);
          if (maxEur <= 0) {
            return err("Importe no válido para reembolso.");
          }

          const { data: tenant } = await supabase
            .from("tenants")
            .select("stripe_account_id, name")
            .eq("id", ctx.tenantId)
            .maybeSingle();
          const acct = (tenant as { stripe_account_id: string | null } | null)
            ?.stripe_account_id;
          if (!acct) {
            return err("Stripe no está vinculado al negocio.");
          }

          const requested =
            input.amountEur != null ? input.amountEur : maxEur;
          if (requested > maxEur + 0.001) {
            return err(
              `No puedes reembolsar más de **${formatEur(maxEur)}** (importe del cobro).`,
            );
          }
          if (requested <= 0) {
            return err("Importe de reembolso inválido.");
          }

          const isPartial = input.amountEur != null && requested < maxEur - 0.001;
          const customerLabel = (p.customer_name ?? p.customer_email ?? "Cliente")
            .trim()
            .slice(0, 60);

          const base: RefundPayload = {
            customerLabel,
            maxEur: formatEur(maxEur),
            refundEur: formatEur(requested),
            isPartial,
          };

          if (!input.confirm) {
            return preview(
              `Vas a **reembolsar ${base.refundEur}**` +
                (isPartial ? " (reembolso parcial) " : " ") +
                `del cobro de **${customerLabel}** (máx. del cobro: ${base.maxEur}). ¿Seguro?`,
              base,
              "Confirmar reembolso en Stripe.",
            );
          }

          try {
            const stripe = getStripeClient();
            const amountCents = Math.round(requested * 100);
            const fullCents = Math.round(maxEur * 100);
            const createParams: {
              charge: string;
              amount?: number;
            } = { charge: p.stripe_charge_id };
            if (amountCents < fullCents) {
              createParams.amount = amountCents;
            }

            const refund = await stripe.refunds.create(createParams, {
              stripeAccount: acct,
            });

            if (refund.status === "failed") {
              return err("Stripe devolvió el reembolso en estado fallido.");
            }

            return ok<RefundPayload>(
              `Reembolso **${formatEur(requested)}** enviado a Stripe (estado: **${refund.status}**). Puede tardar en verse en el listado y en el banco del cliente.`,
              base,
            );
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("STRIPE_SECRET_KEY")) {
              return err("Servicio de pagos no configurado en el servidor.");
            }
            return err(`Stripe: ${msg}`);
          }
        },
      );
    },
  });
}
