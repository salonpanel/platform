import type { WebhookHandlerContext, HandlerResult } from "./types";
import type Stripe from "stripe";

/**
 * Handler para payment_intent.succeeded
 * Marca booking como pagado
 */
export async function handlePaymentIntentSucceeded(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const tenantId = paymentIntent.metadata?.tenant_id;

  try {
    if (!tenantId) {
      return {
        success: false,
        message: "No tenant_id en metadata del payment intent",
      };
    }

    // Actualizar payment si existe, o crear si no existe
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .maybeSingle();

    if (existingPayment) {
      // Actualizar payment existente
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          status: "succeeded",
          balance_status: "pending", // Inicialmente retenido
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", paymentIntent.id);

      if (updateError) {
        console.error("stripe:payment_update_error", {
          payment_intent_id: paymentIntent.id,
          event_id: context.event.id,
          code: updateError.code,
          message: updateError.message,
        });
      }
    } else {
      // Crear payment si no existe (puede pasar si el evento llega antes que checkout.session.completed)
      // PaymentIntent no tiene charges directamente, se obtiene del Charge object
      const amount = paymentIntent.amount / 100;
      const depositValue = paymentIntent.metadata?.deposit
        ? parseFloat(paymentIntent.metadata.deposit)
        : null;
      const totalPriceValue = paymentIntent.metadata?.total_price
        ? parseFloat(paymentIntent.metadata.total_price)
        : amount;

      const { error: insertError } = await supabase
        .from("payments")
        .insert({
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: null, // Charge ID se obtiene del Charge object si es necesario
          barberia_id: tenantId,
          booking_id: paymentIntent.metadata?.booking_id || null,
          service_id: paymentIntent.metadata?.service_id || null,
          customer_email: paymentIntent.receipt_email || null,
          amount: amount,
          deposit: depositValue,
          total_price: totalPriceValue,
          status: "succeeded",
          balance_status: "pending",
          metadata: {
            ...paymentIntent.metadata,
            payment_intent_status: paymentIntent.status,
            connected_account_id: context.connectedAccountId || null,
            currency: paymentIntent.currency || "eur",
          },
        });

      if (insertError) {
        if (insertError.code !== "23505") {
          // No es duplicado, es un error real
          console.error("stripe:payment_insert_error", {
            payment_intent_id: paymentIntent.id,
            event_id: context.event.id,
            code: insertError.code,
            message: insertError.message,
            tenant_id: tenantId,
          });
        }
      } else {
        console.info("stripe:payment_created_from_pi", {
          payment_intent_id: paymentIntent.id,
          amount: amount,
          tenant_id: tenantId,
        });
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando payment_intent.succeeded: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

/**
 * Handler para payment_intent.payment_failed
 * Actualiza booking como fallido
 */
export async function handlePaymentIntentPaymentFailed(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const tenantId = paymentIntent.metadata?.tenant_id;

  try {
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
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_payment_intent_id", paymentIntent.id);

    // Liberar booking si existe
    const bookingId = paymentIntent.metadata?.booking_id;
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
      message: `Error procesando payment_intent.payment_failed: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

