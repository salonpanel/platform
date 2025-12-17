import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin, canModifyPlatform } from "@/lib/platform-auth";
import { createClientForServer } from "@/lib/supabase/server-client";

type RouteParams = {
  params: Promise<{
    orgId: string;
  }>;
};

/**
 * GET /api/admin/tenants/[orgId]/features
 * Obtiene los overrides de features de un tenant (solo platform admins)
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

    // Cargar overrides (tabla en schema platform)
    const { data: overrides, error: overridesError } = await supabase
      .schema("platform")
      .from("org_feature_overrides")
      .select("*")
      .eq("org_id", orgId);

    if (overridesError) {
      return NextResponse.json(
        { error: overridesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(overrides || []);
  } catch (err: any) {
    console.error("Error en GET /api/admin/tenants/[orgId]/features:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tenants/[orgId]/features
 * Toggle feature para un tenant (solo platform admins)
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
    const { feature_key, enabled, expires_at, reason } = body;

    if (!feature_key || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "feature_key y enabled son requeridos" },
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

    // Verificar que el feature existe (tabla en schema platform)
    const { data: feature, error: featureError } = await supabase
      .schema("platform")
      .from("features")
      .select("id, key")
      .eq("key", feature_key)
      .maybeSingle();

    if (featureError || !feature) {
      return NextResponse.json(
        { error: "Feature no encontrado" },
        { status: 404 }
      );
    }

    // Obtener user_id del contexto de autenticación
    const supabaseAuth = await createClientForServer();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();
    const userId = session?.user?.id || null;

    if (enabled) {
      // Crear o actualizar override (tabla en schema platform)
      const { data: override, error: overrideError } = await supabase
        .schema("platform")
        .from("org_feature_overrides")
        .upsert({
          org_id: orgId,
          feature_key: feature_key,
          enabled: true,
          expires_at: expires_at || null,
          reason: reason || "Manual override desde admin",
          created_by: userId,
        })
        .select()
        .single();

      if (overrideError) {
        return NextResponse.json(
          { error: `Error al crear override: ${overrideError.message}` },
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
          action: "feature_toggled",
          target_type: "feature",
          target_id: override.id,
          metadata: {
            feature_key,
            enabled: true,
            expires_at,
            reason,
          },
        });

      return NextResponse.json({
        success: true,
        override,
      });
    } else {
      // Eliminar override (vuelve al comportamiento del plan)
      const { error: deleteError } = await supabase
        .schema("platform")
        .from("org_feature_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("feature_key", feature_key);

      if (deleteError) {
        return NextResponse.json(
          { error: `Error al eliminar override: ${deleteError.message}` },
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
          action: "feature_toggled",
          target_type: "feature",
          target_id: null,
          metadata: {
            feature_key,
            enabled: false,
            reason: "Override eliminado",
          },
        });

      return NextResponse.json({
        success: true,
        message: "Override eliminado",
      });
    }
  } catch (err: any) {
    console.error("Error en PUT /api/admin/tenants/[orgId]/features:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
