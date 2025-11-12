import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/platform-auth";

/**
 * GET /api/admin/plans
 * Lista todos los planes (solo platform admins)
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

    // Cargar planes (tabla en schema platform)
    const { data: plans, error: plansError } = await supabase
      .schema("platform")
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("price_monthly_cents");

    if (plansError) {
      return NextResponse.json(
        { error: plansError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(plans || []);
  } catch (err: any) {
    console.error("Error en GET /api/admin/plans:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

