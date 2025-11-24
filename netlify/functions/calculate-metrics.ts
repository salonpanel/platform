import { getSupabaseServer } from "../../src/lib/supabase/server";

export const handler = async (event: any) => {
  try {
    // Verify cron secret
    const key = event.headers['x-cron-key'] || event.queryStringParameters?.key;
    const expectedKey = process.env.INTERNAL_CRON_KEY;

    if (!expectedKey) {
      console.error("INTERNAL_CRON_KEY no configurado");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Configuración faltante" })
      };
    }

    if (key !== expectedKey) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const sb = getSupabaseServer();

    // Calculate metrics for previous day (default)
    const metricDate = new Date();
    metricDate.setDate(metricDate.getDate() - 1);
    const metricDateStr = metricDate.toISOString().split("T")[0];

    // Direct call to calculate all org metrics function
    const { data, error } = await sb.rpc("calculate_all_org_metrics_daily", {
      p_metric_date: metricDateStr,
    });

    if (error) {
      console.error("Error al calcular métricas diarias:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message ?? "Error al calcular métricas" })
      };
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        summary: summary || {},
      })
    };
  } catch (err: any) {
    console.error("Error inesperado en calculate-metrics:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? "Error inesperado" })
    };
  }
};
