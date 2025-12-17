import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/platform-auth";
import { headers } from "next/headers";

/**
 * GET /api/health/db
 * Health check de la base de datos
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
    // Nota: En un escenario real, extraerías el user_id del JWT y verificarías con isPlatformAdmin()
    // Por ahora, requerimos la clave para acceso no autenticado
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
    const startTime = Date.now();

    // Consulta simple para verificar conectividad
    const { error } = await supabase
      .from("tenants")
      .select("id")
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          service: "database",
          error: error.message,
          response_time_ms: responseTime,
        },
        { status: 503 }
      );
    }

    // Retornar solo estado básico (sin detalles sensibles)
    return NextResponse.json({
      status: "ok",
      service: "database",
      response_time_ms: responseTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        service: "database",
        error: err?.message || "Error desconocido",
      },
      { status: 503 }
    );
  }
}


