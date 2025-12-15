import type { WebhookHandlerContext, HandlerResult } from "./types";
import type Stripe from "stripe";

/**
 * Handler para checkout.session.completed
 * Crea o actualiza booking + payment record
 */
export async function handleCheckoutSessionCompleted(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, stripe, supabase } = context;
  const session = event.data.object as Stripe.Checkout.Session;

  try {
    const appointmentId = session.metadata?.appointment_id;
    const bookingId = session.metadata?.booking_id;
    const paymentIntentId = session.metadata?.payment_intent_id;
    const tenantId = session.metadata?.tenant_id;

    if (!tenantId) {
      return {
        success: false,
        message: "No tenant_id en metadata del checkout session",
      };
    }

    // Obtener Payment Intent para crear registro en payments
    let paymentIntent: Stripe.PaymentIntent | null = null;
    if (session.payment_intent) {
      try {
        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent.id;

        // Si hay connected account, usar ese contexto
        const retrieveOptions = context.connectedAccountId
          ? { stripeAccount: context.connectedAccountId }
          : {};

        paymentIntent = await stripe.paymentIntents.retrieve(piId, retrieveOptions);
      } catch (err) {
        console.error("Error obteniendo payment intent:", err);
        return {
          success: false,
          message: `Error obteniendo payment intent: ${err instanceof Error ? err.message : "Error desconocido"}`,
        };
      }
    }

    // Crear registro en payments si hay información suficiente
    if (paymentIntent) {
      // PaymentIntent no tiene charges directamente, se obtiene del Charge object
      // Por ahora, usamos solo el amount del paymentIntent
      const amount = paymentIntent.amount / 100; // Convertir de céntimos a euros

      // Calcular depósito y precio total desde metadata
      const depositValue = session.metadata?.deposit
        ? parseFloat(session.metadata.deposit)
        : null;
      const totalPriceValue = session.metadata?.total_price
        ? parseFloat(session.metadata.total_price)
        : amount; // Si no hay total_price, usar amount como fallback

      const { error: paymentInsertError } = await supabase
        .from("payments")
        .insert({
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: null, // Charge ID se obtiene del Charge object si es necesario
          stripe_session_id: session.id,
          barberia_id: tenantId,
          booking_id: bookingId || null,
          service_id: session.metadata?.service_id || null,
          customer_name: session.customer_details?.name || null,
          customer_email: session.customer_details?.email || null,
          amount: amount,
          deposit: depositValue,
          total_price: totalPriceValue,
          status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
          balance_status: "pending", // Inicialmente retenido por Stripe
          metadata: {
            ...session.metadata,
            payment_intent_status: paymentIntent.status,
            connected_account_id: context.connectedAccountId || null,
            currency: paymentIntent.currency || "eur",
          },
        });

      // Log estructurado de errores al insertar payment
      if (paymentInsertError) {
        // Si ya existe (por idempotencia), ignorar silenciosamente
        if (paymentInsertError.code === "23505") {
          console.info("stripe:payment_duplicate", {
            payment_intent_id: paymentIntent.id,
            event_id: context.event.id,
          });
        } else {
          // Otro error: loguear estructurado
          console.error("stripe:payment_insert_error", {
            payment_intent_id: paymentIntent.id,
            event_id: context.event.id,
            code: paymentInsertError.code,
            message: paymentInsertError.message,
            details: paymentInsertError.details,
            hint: paymentInsertError.hint,
            tenant_id: tenantId,
            booking_id: bookingId || null,
          });
        }
      } else {
        console.info("stripe:payment_created", {
          payment_intent_id: paymentIntent.id,
          amount: amount,
          tenant_id: tenantId,
          booking_id: bookingId || null,
        });
      }
    }

    // Procesar booking (nuevo modelo)
    if (bookingId || paymentIntentId) {
      // Si hay payment_intent_id, actualizar el payment_intent y confirmar booking
      if (paymentIntentId) {
        const { data: paymentIntent, error: piError } = await supabase
          .from("payment_intents")
          .select("id, status, tenant_id, service_id, customer_id, metadata")
          .eq("id", paymentIntentId)
          .maybeSingle();

        if (!piError && paymentIntent && paymentIntent.status === "requires_payment") {
          // Actualizar payment_intent a paid
          await supabase
            .from("payment_intents")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("id", paymentIntentId);

          // Buscar booking asociado
          const { data: booking } = await supabase
            .from("bookings")
            .select("id, status")
            .eq("payment_intent_id", paymentIntentId)
            .maybeSingle();

          if (booking && booking.status === "pending") {
            // Actualizar booking a paid
            await supabase
              .from("bookings")
              .update({ status: "confirmed", expires_at: null })
              .eq("id", booking.id);
          }
        }
      }

      // Si hay booking_id directo, confirmarlo
      if (bookingId) {
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .select("id, status, expires_at")
          .eq("id", bookingId)
          .maybeSingle();

        if (!bookingError && booking) {
          const now = new Date();
          const expiresAt = booking.expires_at
            ? new Date(booking.expires_at)
            : null;

          const isExpired = expiresAt ? expiresAt <= now : false;
          const alreadyPaid = booking.status === "paid";

          if (!alreadyPaid && !isExpired) {
            await supabase
              .from("bookings")
              .update({ status: "paid", expires_at: null })
              .eq("id", bookingId);
          }
        }
      }
    }

    // Procesar appointment (legacy, mantener compatibilidad)
    if (appointmentId) {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select("id, status, expires_at")
        .eq("id", appointmentId)
        .maybeSingle();

      if (!appointmentError && appointment) {
        const now = new Date();
        const expiresAt = appointment.expires_at
          ? new Date(appointment.expires_at)
          : null;

        const isExpired = expiresAt ? expiresAt <= now : false;
        const alreadyConfirmed = appointment.status === "confirmed";

        if (!alreadyConfirmed && !isExpired) {
          await supabase
            .from("appointments")
            .update({ status: "confirmed", expires_at: null })
            .eq("id", appointmentId);
        }
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando checkout.session.completed: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

