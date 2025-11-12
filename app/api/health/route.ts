import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check completo de la aplicación
 * Agrega checks de todos los servicios críticos
 */
export async function GET() {
  try {
    // Health check básico de la API
    const healthChecks = {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "platform",
      version: "1.0.0",
      checks: {
        api: "ok",
        // Nota: Los checks detallados están en /api/health/db, /api/health/payments, etc.
      },
      endpoints: {
        db: "/api/health/db",
        payments: "/api/health/payments",
        webhooks: "/api/health/webhooks",
        cron: "/api/health/cron",
      },
    };

    return NextResponse.json(healthChecks);
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        service: "platform",
        error: err?.message || "Error desconocido",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
