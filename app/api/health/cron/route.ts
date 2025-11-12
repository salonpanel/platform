import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

/**
 * GET /api/health/cron
 * Health check de cron jobs (métricas de limpieza de holds)
 */
export async function GET() {
  try {
    const supabase = supabaseServer();

    // Obtener métricas de holds expirados (últimas 24 horas)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Holds expirados cancelados
    const { data: expiredHolds, error: expiredError } = await supabase
      .from("bookings")
      .select("id, status, created_at")
      .eq("status", "cancelled")
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false });

    if (expiredError) {
      return NextResponse.json(
        {
          status: "error",
          service: "cron",
          error: expiredError.message,
        },
        { status: 503 }
      );
    }

    // Holds pendientes que expiran pronto (próximos 5 minutos)
    const soonExpiring = new Date();
    soonExpiring.setMinutes(soonExpiring.getMinutes() + 5);

    const { data: soonExpiringHolds, error: soonExpiringError } = await supabase
      .from("bookings")
      .select("id, status, expires_at")
      .eq("status", "pending")
      .not("expires_at", "is", null)
      .lte("expires_at", soonExpiring.toISOString())
      .gte("expires_at", new Date().toISOString());

    if (soonExpiringError) {
      return NextResponse.json(
        {
          status: "error",
          service: "cron",
          error: soonExpiringError.message,
        },
        { status: 503 }
      );
    }

    // Calcular métricas
    const totalExpired = expiredHolds?.length || 0;
    const totalSoonExpiring = soonExpiringHolds?.length || 0;

    return NextResponse.json({
      status: "ok",
      service: "cron",
      metrics: {
        expired_holds_24h: totalExpired,
        soon_expiring_holds: totalSoonExpiring,
        last_cleanup: expiredHolds && expiredHolds.length > 0
          ? expiredHolds[0].created_at
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        service: "cron",
        error: err?.message || "Error desconocido",
      },
      { status: 503 }
    );
  }
}

