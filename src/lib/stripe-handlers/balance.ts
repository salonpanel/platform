import type { WebhookHandlerContext, HandlerResult } from "./types";
import type Stripe from "stripe";

/**
 * Handler para balance.available (Stripe Connect)
 * Actualiza el balance_status de los pagos a "available"
 */
export async function handleBalanceAvailable(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const balanceTransaction = event.data.object as unknown as Stripe.BalanceTransaction;

  try {
    // balance.available solo se dispara para cuentas conectadas
    if (!context.connectedAccountId) {
      return {
        success: false,
        message: "balance.available solo se aplica a cuentas conectadas",
      };
    }

    const chargeId = balanceTransaction.source as string;

    // Actualizar balance_status a available solo para charges
    if (chargeId && balanceTransaction.type === "charge") {
      await supabase
        .from("payments")
        .update({
          balance_status: "available",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_charge_id", chargeId);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando balance.available: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

