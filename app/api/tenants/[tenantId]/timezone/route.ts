import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type RouteParams = {
  params: Promise<{
    tenantId: string;
  }>;
};

/**
 * GET /api/tenants/[tenantId]/timezone
 * Obtiene el timezone de un tenant
 */
export async function GET(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { tenantId } = await params;
    const supabase = supabaseServer();

    // Obtener timezone del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, timezone")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tenant_id: tenant.id,
      timezone: tenant.timezone || "Europe/Madrid",
    });
  } catch (err: any) {
    console.error("Error en GET /api/tenants/[tenantId]/timezone:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

