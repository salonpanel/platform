import Stripe from "stripe";

/**
 * Inicializa el cliente de Stripe con la clave secreta
 * Usa la clave de test o producción según el entorno
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY no está configurado en las variables de entorno");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-10-29.clover" as const,
    typescript: true,
  });
}

/**
 * Cliente Stripe singleton para uso en toda la aplicación
 */
export const stripe = getStripeClient();
