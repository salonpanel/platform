import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin, canModifyPlatform } from "@/lib/platform-auth";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type RouteParams = {
  params: Promise<{
    orgId: string;
  }>;
};

/**
 * GET /api/admin/tenants/[orgId]/timezone
 * Obtiene el timezone de un tenant (solo platform admins)
 */
export async function GET(
  req: Request,
  { params }: RouteParams
) {
  try {
    // Verificar que el usuario es platform admin
    const isAdmin = await isPlatformAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    const { orgId } = await params;
    const supabase = supabaseServer();

    // Obtener timezone del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, timezone")
      .eq("id", orgId)
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
    console.error("Error en GET /api/admin/tenants/[orgId]/timezone:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tenants/[orgId]/timezone
 * Actualiza el timezone de un tenant (solo platform admins)
 */
export async function PUT(
  req: Request,
  { params }: RouteParams
) {
  try {
    // Verificar que el usuario tiene permisos de modificación (admin o support)
    const canModify = await canModifyPlatform();
    if (!canModify) {
      return NextResponse.json(
        { error: "No autorizado. Se requieren permisos de admin o support." },
        { status: 403 }
      );
    }

    const { orgId } = await params;
    const body = await req.json();
    const { timezone } = body;

    if (!timezone || typeof timezone !== "string") {
      return NextResponse.json(
        { error: "timezone es requerido y debe ser una cadena" },
        { status: 400 }
      );
    }

    // Validar que timezone es válido (formato básico)
    if (!/^[A-Za-z_]+(\/[A-Za-z_]+)+$/.test(timezone) && timezone !== "UTC") {
      return NextResponse.json(
        { error: "timezone no válido. Debe ser un timezone válido de PostgreSQL (ej: Europe/Madrid, America/New_York)" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Verificar que el tenant existe
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", orgId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Obtener user_id del contexto de autenticación
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();
    const userId = session?.user?.id || null;

    // Actualizar timezone del tenant
    const { data: updatedTenant, error: updateError } = await supabase
      .from("tenants")
      .update({ timezone })
      .eq("id", orgId)
      .select("id, timezone")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Error al actualizar timezone: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Auditar cambio (usar tabla platform.audit_logs directamente)
    await supabase
      .schema("platform")
      .from("audit_logs")
      .insert({
        actor_id: userId,
        actor_type: "platform",
        scope: "platform",
        org_id: orgId,
        action: "timezone_updated",
        target_type: "tenant",
        target_id: orgId,
        metadata: {
          timezone,
        },
      });

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (err: any) {
    console.error("Error en PUT /api/admin/tenants/[orgId]/timezone:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

