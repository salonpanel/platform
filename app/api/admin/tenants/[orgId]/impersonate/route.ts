import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin, canModifyPlatform } from "@/lib/platform-auth";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { addHours } from "date-fns";

type RouteParams = {
  params: Promise<{
    orgId: string;
  }>;
};

/**
 * POST /api/admin/tenants/[orgId]/impersonate
 * Inicia impersonación de un tenant (solo platform admins)
 */
export async function POST(
  req: Request,
  { params }: RouteParams
) {
  try {
    // Verificar que el usuario tiene permisos de modificación (admin o support)
    const canModify = await canModifyPlatform();
    if (!canModify) {
      return NextResponse.json(
        { error: "No autorizado. Se requieren permisos de admin o support para impersonar." },
        { status: 403 }
      );
    }

    const { orgId } = await params;
    const body = await req.json();
    const { reason, expires_in_hours } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "reason es requerido" },
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

    if (!userId) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Crear registro de impersonación (tabla en schema platform)
    const expiresAt = expires_in_hours
      ? addHours(new Date(), expires_in_hours).toISOString()
      : addHours(new Date(), 8).toISOString(); // Default: 8 horas

    const { data: impersonation, error: impersonationError } = await supabase
      .schema("platform")
      .from("impersonations")
      .insert({
        org_id: orgId,
        initiator_platform_user_id: userId,
        reason: reason.trim(),
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (impersonationError) {
      return NextResponse.json(
        { error: `Error al crear impersonación: ${impersonationError.message}` },
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
        action: "impersonation_started",
        target_type: "impersonation",
        target_id: impersonation.id,
        metadata: {
          reason,
          expires_at: expiresAt,
        },
      });

    return NextResponse.json({
      success: true,
      impersonation,
      redirect_url: `/panel?impersonate=${orgId}`,
    });
  } catch (err: any) {
    console.error("Error en POST /api/admin/tenants/[orgId]/impersonate:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tenants/[orgId]/impersonate
 * Termina impersonación de un tenant (solo platform admins)
 */
export async function DELETE(
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
    const supabase = supabaseServer();

    // Obtener user_id del contexto de autenticación
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();
    const userId = session?.user?.id || null;

    if (!userId) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Terminar impersonación activa (tabla en schema platform)
    const { data: impersonation, error: impersonationError } = await supabase
      .schema("platform")
      .from("impersonations")
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("initiator_platform_user_id", userId)
      .is("ended_at", null)
      .select()
      .maybeSingle();

    if (impersonationError) {
      return NextResponse.json(
        { error: `Error al terminar impersonación: ${impersonationError.message}` },
        { status: 500 }
      );
    }

    if (!impersonation) {
      return NextResponse.json(
        { error: "No hay impersonación activa" },
        { status: 404 }
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
        action: "impersonation_ended",
        target_type: "impersonation",
        target_id: impersonation.id,
        metadata: {},
      });

    return NextResponse.json({
      success: true,
      message: "Impersonación terminada",
    });
  } catch (err: any) {
    console.error("Error en DELETE /api/admin/tenants/[orgId]/impersonate:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

