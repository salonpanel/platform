import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/platform-auth";

/**
 * GET /api/admin/features
 * Lista todos los features (solo platform admins)
 */
export async function GET() {
  try {
    // Verificar que el usuario es platform admin
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const supabase = supabaseServer();

    // Cargar features (tabla en schema platform)
    const { data: features, error: featuresError } = await supabase
      .schema("platform")
      .from("features")
      .select("*")
      .order("name");

    if (featuresError) {
      return NextResponse.json(
        { error: featuresError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(features || []);
  } catch (err: any) {
    console.error("Error en GET /api/admin/features:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

