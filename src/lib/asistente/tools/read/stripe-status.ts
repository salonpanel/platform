/**
 * Tool: get_stripe_status
 *
 * Estado de la cuenta Connect del negocio (flags en `tenants`, sin exponer
 * el identificador completo de Stripe).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({});

interface StripePayload {
  hasConnectedAccount: boolean;
  onboardingStatus: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** true si cobros y payouts activos */
  readyToOperate: boolean;
}

export function buildGetStripeStatusTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Devuelve el estado de Stripe Connect del negocio: si hay cuenta enlazada, onboarding, si se pueden cobrar y si los payouts a banco están listos. Úsala para '¿Stripe está listo?', '¿me pueden pagar online?'.",
    inputSchema: InputSchema,
    execute: async (): Promise<ToolOutput<StripePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_stripe_status",
          toolCategory: "READ_LOW",
          toolInput: null,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("tenants")
            .select(
              "stripe_account_id, stripe_onboarding_status, stripe_charges_enabled, stripe_payouts_enabled",
            )
            .eq("id", ctx.tenantId)
            .maybeSingle();

          if (error || !data) {
            return err("No se pudo leer el estado de pagos.");
          }

          const t = data as {
            stripe_account_id: string | null;
            stripe_onboarding_status: string | null;
            stripe_charges_enabled: boolean | null;
            stripe_payouts_enabled: boolean | null;
          };

          const hasConnectedAccount = Boolean(
            t.stripe_account_id && String(t.stripe_account_id).length > 0,
          );
          const charges = !!t.stripe_charges_enabled;
          const payouts = !!t.stripe_payouts_enabled;
          const readyToOperate = hasConnectedAccount && charges && payouts;
          const onboard = t.stripe_onboarding_status;

          const payload: StripePayload = {
            hasConnectedAccount,
            onboardingStatus: onboard,
            chargesEnabled: charges,
            payoutsEnabled: payouts,
            readyToOperate,
          };

          let summary: string;
          if (!hasConnectedAccount) {
            summary =
              "No hay cuenta de Stripe vinculada aún (conecta en Ajustes / Pagos).";
          } else if (readyToOperate) {
            summary =
              "Stripe operativo: cobros y transferencias a banco habilitados.";
          } else {
            const bits: string[] = [];
            if (onboard) {
              bits.push(`onboarding: ${onboard}`);
            }
            if (!charges) {
              bits.push("cobros aún no habilitados");
            }
            if (!payouts) {
              bits.push("payouts aún no habilitados");
            }
            summary = `Stripe vinculado; falta completar: ${bits.join(" · ")}.`;
          }

          return ok<StripePayload>(summary, payload);
        },
      );
    },
  });
}
