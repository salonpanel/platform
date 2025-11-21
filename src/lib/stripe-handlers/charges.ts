import type { WebhookHandlerContext, HandlerResult } from "./types";
import type Stripe from "stripe";

/**
 * Handler para charge.succeeded
 * Crea movimiento en payments table
 */
export async function handleChargeSucceeded(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, stripe, supabase } = context;
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;

  try {
    if (!paymentIntentId) {
      return {
        success: false,
        message: "No payment_intent_id en charge",
      };
    }

    // Obtener payment intent para obtener tenant_id
    const retrieveOptions = context.connectedAccountId
      ? { stripeAccount: context.connectedAccountId }
      : {};

    const pi = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      retrieveOptions
    );
    const tenantId = pi.metadata?.tenant_id;

    if (!tenantId) {
      return {
        success: false,
        message: "No tenant_id en metadata del payment intent",
      };
    }

    // Actualizar payment si existe
    await supabase
      .from("payments")
      .update({
        stripe_charge_id: charge.id,
        status: "succeeded",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_payment_intent_id", paymentIntentId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando charge.succeeded: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

/**
 * Handler para charge.refunded
 * Marca payment como reembolsado
 */
export async function handleChargeRefunded(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, stripe, supabase } = context;
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;

  try {
    if (!paymentIntentId) {
      return {
        success: false,
        message: "No payment_intent_id en charge",
      };
    }

    // Obtener payment intent para obtener tenant_id
    const retrieveOptions = context.connectedAccountId
      ? { stripeAccount: context.connectedAccountId }
      : {};

    const pi = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      retrieveOptions
    );
    const tenantId = pi.metadata?.tenant_id;

    if (!tenantId) {
      return {
        success: false,
        message: "No tenant_id en metadata del payment intent",
      };
    }

    // Actualizar payment
    await supabase
      .from("payments")
      .update({
        status: "refunded",
        balance_status: "adjusted",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_payment_intent_id", paymentIntentId);

    // Actualizar booking a cancelled si existe
    const bookingId = pi.metadata?.booking_id;
    if (bookingId) {
      await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando charge.refunded: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}



