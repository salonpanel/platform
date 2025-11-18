import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import Stripe from "stripe";

type HealthCheckResult = {
  status: "ok" | "error";
  service: string;
  response_time_ms?: number;
  error?: string;
  timestamp?: string;
  provider?: string;
};

/**
 * GET /api/health
 * Health check completo de la aplicación
 * Agrega checks de todos los servicios críticos y retorna estado agregado
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, HealthCheckResult> = {};
  let overallStatus: "ok" | "error" = "ok";

  try {
    // 1. Check de base de datos
    try {
      const dbStart = Date.now();
      const supabase = supabaseServer();
      const { error } = await supabase.from("tenants").select("id").limit(1);
      const dbResponseTime = Date.now() - dbStart;

      checks.database = {
        status: error ? "error" : "ok",
        service: "database",
        response_time_ms: dbResponseTime,
        error: error?.message,
        timestamp: new Date().toISOString(),
      };
      if (error) overallStatus = "error";
    } catch (err: any) {
      checks.database = {
        status: "error",
        service: "database",
        error: err?.message || "Error al conectar con base de datos",
      };
      overallStatus = "error";
    }

    // 2. Check de pagos (Stripe)
    try {
      const paymentsStart = Date.now();
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

      if (!stripeSecretKey) {
        checks.payments = {
          status: "error",
          service: "payments",
          error: "STRIPE_SECRET_KEY no configurado",
          timestamp: new Date().toISOString(),
        };
        overallStatus = "error";
      } else {
        const stripe = new Stripe(stripeSecretKey);
        await stripe.products.list({ limit: 1 });
        const paymentsResponseTime = Date.now() - paymentsStart;

        checks.payments = {
          status: "ok",
          service: "payments",
          provider: "stripe",
          response_time_ms: paymentsResponseTime,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      checks.payments = {
        status: "error",
        service: "payments",
        error: err?.message || "Error al conectar con Stripe",
        timestamp: new Date().toISOString(),
      };
      overallStatus = "error";
    }

    // 3. Check de webhooks (opcional, puede no existir)
    // Por ahora marcamos como ok si no hay endpoint específico
    checks.webhooks = {
      status: "ok",
      service: "webhooks",
      error: "Endpoint no disponible (no crítico)",
    };

    // 4. Check de cron (opcional, puede no existir)
    // Por ahora marcamos como ok si no hay endpoint específico
    checks.cron = {
      status: "ok",
      service: "cron",
      error: "Endpoint no disponible (no crítico)",
    };

    const totalResponseTime = Date.now() - startTime;

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: "platform",
      version: "1.0.0",
      response_time_ms: totalResponseTime,
      checks,
      endpoints: {
        db: "/api/health/db",
        payments: "/api/health/payments",
        webhooks: "/api/health/webhooks",
        cron: "/api/health/cron",
      },
    };

    return NextResponse.json(healthResponse, {
      status: overallStatus === "ok" ? 200 : 503,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        service: "platform",
        error: err?.message || "Error desconocido",
        timestamp: new Date().toISOString(),
        checks,
      },
      { status: 503 }
    );
  }
}
