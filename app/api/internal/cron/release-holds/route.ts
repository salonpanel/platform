import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/cron/release-holds
 * Endpoint interno para limpiar holds expirados (llamado por Vercel Cron)
 * 
 * Protección: Requiere cabecera x-cron-key
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

    // P0.2: Llamar a la función de limpieza de holds expirados
    const { data, error } = await sb.rpc("release_expired_holds");

    if (error) {
      console.error("Error al limpiar holds expirados:", error);
      return NextResponse.json(
        { error: error.message ?? "Error al limpiar holds" },
        { status: 500 }
      );
    }

    // P0.2: La función retorna el número de holds liberados
    const releasedCount = (data as number) || 0;

    console.info("cron:release_holds", {
      released: releasedCount,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      released: releasedCount,
    });
  } catch (err: any) {
    console.error("Error inesperado en release-holds:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

