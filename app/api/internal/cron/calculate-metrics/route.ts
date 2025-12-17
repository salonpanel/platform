import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/cron/calculate-metrics
 * Endpoint interno para calcular métricas diarias (llamado por Vercel Cron)
 * 
 * Protección: Requiere cabecera x-cron-key o query parameter ?key=
 */
export async function POST(req: Request) {
  try {
    // Protección: cabecera o query parameter (Vercel no permite headers personalizados en cron)
    const url = new URL(req.url);
    const key = req.headers.get("x-cron-key") || url.searchParams.get("key");
    const expectedKey = process.env.INTERNAL_CRON_KEY;

    if (!expectedKey) {
      console.error("INTERNAL_CRON_KEY no configurado");
      return NextResponse.json(
        { error: "Configuración faltante" },
        { status: 500 }
      );
    }

    if (key !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sb = supabaseServer();

    // Calcular métricas para el día anterior (default)
    const metricDate = new Date();
    metricDate.setDate(metricDate.getDate() - 1);
    const metricDateStr = metricDate.toISOString().split("T")[0];

    // Llamar a la función para calcular métricas de todos los tenants
    // Nota: La función tiene parámetro por defecto, pero lo pasamos explícitamente
    const { data, error } = await sb.rpc("calculate_all_org_metrics_daily", {
      p_metric_date: metricDateStr,
    });

    if (error) {
      console.error("Error al calcular métricas diarias:", error);
      return NextResponse.json(
        { error: error.message ?? "Error al calcular métricas" },
        { status: 500 }
      );
    }

    const summary = data as {
      metric_date: string;
      tenants_processed: number;
      total_bookings: number;
      total_revenue_cents: number;
    };

    console.info("cron:calculate_metrics", {
      metric_date: metricDateStr,
      tenants_processed: summary?.tenants_processed || 0,
      total_bookings: summary?.total_bookings || 0,
      total_revenue_cents: summary?.total_revenue_cents || 0,
    });

    return NextResponse.json({
      ok: true,
      summary: summary || {},
    });
  } catch (err: any) {
    console.error("Error inesperado en calculate-metrics:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

