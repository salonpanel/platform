import type { WebhookHandlerContext, HandlerResult } from "./types";
import { handleCheckoutSessionCompleted } from "./checkout";
import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentPaymentFailed,
} from "./payment-intents";
import { handleChargeSucceeded, handleChargeRefunded } from "./charges";
import { handleBalanceAvailable } from "./balance";
import { handlePayoutPaid, handlePayoutFailed } from "./payouts";
import {
  handleDisputeCreated,
  handleDisputeClosed,
} from "./disputes";

/**
 * Mapa de handlers por tipo de evento
 */
const EVENT_HANDLERS: Record<string, (context: WebhookHandlerContext) => Promise<HandlerResult>> = {
  "checkout.session.completed": handleCheckoutSessionCompleted,
  "payment_intent.succeeded": handlePaymentIntentSucceeded,
  "payment_intent.payment_failed": handlePaymentIntentPaymentFailed,
  "charge.succeeded": handleChargeSucceeded,
  "charge.refunded": handleChargeRefunded,
  "balance.available": handleBalanceAvailable,
  "payout.paid": handlePayoutPaid,
  "payout.failed": handlePayoutFailed,
  "charge.dispute.created": handleDisputeCreated,
  "charge.dispute.closed": handleDisputeClosed,
};

/**
 * Procesa un evento de Stripe usando el handler correspondiente
 */
export async function processStripeEvent(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const eventType = context.event.type;
  const handler = EVENT_HANDLERS[eventType];

  if (!handler) {
    // Evento no soportado - retornar éxito para que Stripe no reintente
    console.info("stripe:unsupported_event", {
      type: eventType,
      eventId: context.event.id,
    });
    return { success: true, message: `Evento no soportado: ${eventType}` };
  }

  try {
    return await handler(context);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error ejecutando handler para ${eventType}: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

/**
 * Obtiene la lista de tipos de eventos soportados
 */
export function getSupportedEventTypes(): string[] {
  return Object.keys(EVENT_HANDLERS);
}

