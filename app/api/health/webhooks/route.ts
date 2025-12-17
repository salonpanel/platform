import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { headers } from "next/headers";

/**
 * GET /api/health/webhooks
 * Health check de webhooks (métricas de eventos procesados)
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

    // Obtener métricas de webhooks procesados (últimas 24 horas)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: events, error: eventsError } = await supabase
      .from("stripe_events_processed")
      .select("event_type, created_at")
      .gte("created_at", yesterday.toISOString())
      .order("created_at", { ascending: false });

    if (eventsError) {
      return NextResponse.json(
        {
          status: "error",
          service: "webhooks",
          error: eventsError.message,
        },
        { status: 503 }
      );
    }

    // Calcular métricas
    const totalEvents = events?.length || 0;
    const eventsByType = (events || []).reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Último evento procesado
    const lastEvent = events && events.length > 0 ? events[0] : null;

    return NextResponse.json({
      status: "ok",
      service: "webhooks",
      metrics: {
        total_events_24h: totalEvents,
        events_by_type: eventsByType,
        last_event: lastEvent
          ? {
              type: lastEvent.event_type,
              processed_at: lastEvent.created_at,
            }
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        service: "webhooks",
        error: err?.message || "Error desconocido",
      },
      { status: 503 }
    );
  }
}

