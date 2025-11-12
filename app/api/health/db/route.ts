import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

/**
 * GET /api/health/db
 * Health check de la base de datos
 */
export async function GET() {
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

