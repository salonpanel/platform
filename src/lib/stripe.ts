import Stripe from "stripe";

/**
 * Inicializa el cliente de Stripe con la clave secreta
 * Usa la clave de test o producción según el entorno
 */
let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeInstance) return stripeInstance;

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY no está configurado en las variables de entorno");
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: "2025-10-29.clover" as const,
    typescript: true,
  });

  return stripeInstance;
}

/**
 * Cliente Stripe singleton perezoso para uso en toda la aplicación.
 * El uso de Proxy evita que el error de STRIPE_SECRET_KEY se dispare
 * durante la fase de compilación de Next.js si no se está usando activamente.
 */
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    const client = getStripeClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

