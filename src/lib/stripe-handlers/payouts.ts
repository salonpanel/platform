import type { WebhookHandlerContext, HandlerResult } from "./types";
import type Stripe from "stripe";

/**
 * Handler para payout.paid
 * Registra movimiento de payout
 */
export async function handlePayoutPaid(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const payout = event.data.object as Stripe.Payout;

  try {
    // payout.paid solo se dispara para cuentas conectadas
    if (!context.connectedAccountId) {
      return {
        success: false,
        message: "payout.paid solo se aplica a cuentas conectadas",
      };
    }

    // Obtener tenant_id desde la cuenta conectada
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("stripe_account_id", context.connectedAccountId)
      .maybeSingle();

    if (!tenant) {
      return {
        success: false,
        message: `No se encontró tenant para cuenta conectada: ${context.connectedAccountId}`,
      };
    }

    // Actualizar payments que fueron incluidos en este payout
    // Nota: Stripe no proporciona directamente qué charges están en un payout
    // Esto se puede hacer consultando balance transactions asociados al payout
    // Por ahora, solo logueamos el payout

    console.info("stripe:payout_paid", {
      payout_id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      tenant_id: tenant.id,
      connected_account_id: context.connectedAccountId,
    });

    // Opcional: Actualizar balance_status a "paid_out" para pagos antiguos
    // Esto requeriría consultar balance transactions del payout

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando payout.paid: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

/**
 * Handler para payout.failed
 * Registra error de payout
 */
export async function handlePayoutFailed(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const payout = event.data.object as Stripe.Payout;

  try {
    // payout.failed solo se dispara para cuentas conectadas
    if (!context.connectedAccountId) {
      return {
        success: false,
        message: "payout.failed solo se aplica a cuentas conectadas",
      };
    }

    // Obtener tenant_id desde la cuenta conectada
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("stripe_account_id", context.connectedAccountId)
      .maybeSingle();

    if (!tenant) {
      return {
        success: false,
        message: `No se encontró tenant para cuenta conectada: ${context.connectedAccountId}`,
      };
    }

    // Log del error
    console.error("stripe:payout_failed", {
      payout_id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      tenant_id: tenant.id,
      connected_account_id: context.connectedAccountId,
      failure_code: payout.failure_code,
      failure_message: payout.failure_message,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando payout.failed: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}



