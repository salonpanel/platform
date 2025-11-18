import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";

/**
 * GET /api/health/payments
 * Health check de Stripe
 * 
 * SEGURIDAD: Protegido con INTERNAL_HEALTH_KEY o autenticación de Platform Admin
 * 
 * Acceso:
 * - Query param: ?key=INTERNAL_HEALTH_KEY
 * - O autenticación de Platform Admin
 */
export async function GET(req: Request) {
  // Verificar acceso: clave interna o platform admin
  const url = new URL(req.url);
  const healthKey = url.searchParams.get("key");
  const internalHealthKey = process.env.INTERNAL_HEALTH_KEY;

  // Si hay clave, verificar que coincida
  if (healthKey) {
    if (!internalHealthKey || healthKey !== internalHealthKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  } else {
    // Si no hay clave, requerir autenticación de Platform Admin
    if (!internalHealthKey) {
      return NextResponse.json(
        { error: "Unauthorized. Se requiere INTERNAL_HEALTH_KEY o autenticación de Platform Admin." },
        { status: 401 }
      );
    }
    // Si hay internalHealthKey configurado pero no se proporcionó en la query, rechazar
    return NextResponse.json(
      { error: "Unauthorized. Se requiere INTERNAL_HEALTH_KEY en query param." },
      { status: 401 }
    );
  }
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

    // Retornar solo estado básico (sin detalles sensibles)
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


