import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin, canModifyPlatform } from "@/lib/platform-auth";

type RouteParams = {
  params: Promise<{
    orgId: string;
  }>;
};

/**
 * GET /api/admin/tenants/[orgId]/plan
 * Obtiene el plan de un tenant (solo platform admins)
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

    // Cargar plan de la org (tabla en schema platform)
    const { data: orgPlan, error: orgPlanError } = await supabase
      .schema("platform")
      .from("org_plans")
      .select("plan_id, billing_state")
      .eq("org_id", orgId)
      .maybeSingle();

    if (orgPlanError) {
      return NextResponse.json(
        { error: orgPlanError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(orgPlan);
  } catch (err: any) {
    console.error("Error en GET /api/admin/tenants/[orgId]/plan:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/tenants/[orgId]/plan
 * Cambia el plan de un tenant (solo platform admins)
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
    const { plan_id, billing_state } = body;

    if (!plan_id) {
      return NextResponse.json(
        { error: "plan_id es requerido" },
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

    // Verificar que el plan existe
    const { data: plan, error: planError } = await supabase
      .schema("platform")
      .from("plans")
      .select("id, key")
      .eq("id", plan_id)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 }
      );
    }

    // Obtener user_id del contexto de autenticación
    const { cookies } = await import("next/headers");
    const { createRouteHandlerClient } = await import("@supabase/auth-helpers-nextjs");
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();
    const userId = session?.user?.id || null;

    // Actualizar o crear plan de la org
    const { data: orgPlan, error: orgPlanError } = await supabase
      .schema("platform")
      .from("org_plans")
      .upsert({
        org_id: orgId,
        plan_id: plan_id,
        billing_state: billing_state || "active",
      })
      .select()
      .single();

    if (orgPlanError) {
      return NextResponse.json(
        { error: `Error al actualizar plan: ${orgPlanError.message}` },
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
        action: "plan_changed",
        target_type: "plan",
        target_id: plan_id,
        metadata: {
          plan_key: plan.key,
          billing_state: billing_state || "active",
        },
      });

    return NextResponse.json({
      success: true,
      orgPlan,
    });
  } catch (err: any) {
    console.error("Error en PUT /api/admin/tenants/[orgId]/plan:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

