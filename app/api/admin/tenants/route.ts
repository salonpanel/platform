import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/platform-auth";

/**
 * GET /api/admin/tenants
 * Lista todos los tenants con sus planes y features (solo platform admins)
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

    // Cargar tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (tenantsError) {
      return NextResponse.json(
        { error: tenantsError.message },
        { status: 500 }
      );
    }

    // Cargar planes y features para cada tenant
    const tenantsWithData = await Promise.all(
      (tenants || []).map(async (tenant) => {
        // Cargar plan de la org usando consulta SQL directa (las tablas están en schema platform)
        // Con service_role podemos acceder directamente
        const { data: orgPlan, error: orgPlanError } = await supabase
          .rpc("get_org_plan_info", { p_org_id: tenant.id })
          .single();

        let planData = null;
        if (!orgPlanError && orgPlan) {
          planData = orgPlan;
        } else {
          // Fallback: intentar consulta directa (puede fallar si no hay permisos)
          try {
            const { data: directPlan } = await supabase
              .from("org_plans")
              .select("plan_id, billing_state")
              .eq("org_id", tenant.id)
              .maybeSingle();

            if (directPlan?.plan_id) {
              const { data: plan } = await supabase
                .from("plans")
                .select("key, name")
                .eq("id", directPlan.plan_id)
                .maybeSingle();
              planData = plan
                ? {
                    key: plan.key,
                    name: plan.name,
                    billing_state: directPlan.billing_state,
                  }
                : null;
            }
          } catch (e) {
            // Ignorar errores de consulta directa
            console.warn("No se pudo cargar plan para tenant:", tenant.id);
          }
        }

        // Cargar features activos usando RPC
        const { data: features } = await supabase.rpc("get_org_features", {
          p_org_id: tenant.id,
        });

        // KPIs básicos
        const [bookingsCount, servicesCount, staffCount] = await Promise.all([
          // Reservas totales
          supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),
          // Servicios activos
          supabase
            .from("services")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("active", true),
          // Staff activo
          supabase
            .from("staff")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("active", true),
        ]);

        // Reservas de hoy
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const { count: bookingsToday } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .gte("starts_at", todayStart.toISOString())
          .lte("starts_at", todayEnd.toISOString());

        return {
          ...tenant,
          plan: planData,
          active_features: (features || [])
            .filter((f: any) => f.enabled)
            .map((f: any) => f.feature_key),
          kpis: {
            total_bookings: bookingsCount.count || 0,
            bookings_today: bookingsToday || 0,
            active_services: servicesCount.count || 0,
            active_staff: staffCount.count || 0,
          },
        };
      })
    );

    return NextResponse.json(tenantsWithData);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al obtener tenants" },
      { status: 500 }
    );
  }
}

