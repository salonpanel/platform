import type { WebhookHandlerContext, HandlerResult } from "./types";
import type Stripe from "stripe";

/**
 * Handler para charge.dispute.created
 * Marca payment como disputado
 */
export async function handleDisputeCreated(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = dispute.charge as string;

  try {
    if (!chargeId) {
      return {
        success: false,
        message: "No charge_id en dispute",
      };
    }

    // Actualizar payment
    await supabase
      .from("payments")
      .update({
        status: "disputed",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_charge_id", chargeId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando charge.dispute.created: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

/**
 * Handler para charge.dispute.closed
 * Resuelve disputa según resultado
 */
export async function handleDisputeClosed(
  context: WebhookHandlerContext
): Promise<HandlerResult> {
  const { event, supabase } = context;
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = dispute.charge as string;

  try {
    if (!chargeId) {
      return {
        success: false,
        message: "No charge_id en dispute",
      };
    }

    // Si la disputa se resolvió a favor del merchant, volver a succeeded
    // Si se resolvió en contra, mantener disputed
    const status = dispute.status === "won" ? "succeeded" : "disputed";

    await supabase
      .from("payments")
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_charge_id", chargeId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      message: `Error procesando charge.dispute.closed: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}



