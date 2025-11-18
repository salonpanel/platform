import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { headers } from "next/headers";

/**
 * GET /api/health/cron
 * Health check de cron jobs (métricas de limpieza de holds)
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

