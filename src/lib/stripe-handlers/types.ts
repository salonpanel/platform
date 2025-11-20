import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Contexto compartido para todos los handlers de webhooks
 */
export interface WebhookHandlerContext {
  event: Stripe.Event;
  stripe: Stripe;
  supabase: SupabaseClient;
  connectedAccountId?: string; // ID de la cuenta conectada (Stripe Connect)
}

/**
 * Resultado de procesamiento de un handler
 */
export interface HandlerResult {
  success: boolean;
  message?: string;
  error?: Error;
}

/**
 * Tipo de función handler
 */
export type WebhookHandler = (
  context: WebhookHandlerContext
) => Promise<HandlerResult>;

