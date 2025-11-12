import { NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * GET /api/health/payments
 * Health check de Stripe
 */
export async function GET() {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          status: "error",
          service: "payments",
          error: "STRIPE_SECRET_KEY no configurado",
        },
        { status: 503 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    });

    const startTime = Date.now();

    // Verificar conectividad con Stripe (listar productos, límite 1)
    await stripe.products.list({ limit: 1 });

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: "ok",
      service: "payments",
      provider: "stripe",
      response_time_ms: responseTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        service: "payments",
        error: err?.message || "Error desconocido",
      },
      { status: 503 }
    );
  }
}

