import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { isPlatformAdmin, canModifyPlatform } from "@/lib/platform-auth";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * POST /api/admin/tenants
 * Crea un nuevo tenant con owner (solo platform admins)
 */
export async function POST(req: Request) {
  try {
    // Verificar que el usuario es platform admin con permisos de modificación
    const canModify = await canModifyPlatform();
    if (!canModify) {
      return NextResponse.json(
        { error: "No autorizado. Se requieren permisos de admin o support." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, slug, timezone, owner_email, owner_name, plan_key } = body;

    // Validaciones
    if (!name || !slug || !timezone || !owner_email) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, slug, timezone, owner_email" },
        { status: 400 }
      );
    }

    // Validar formato de slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "El slug solo puede contener letras minúsculas, números y guiones" },
        { status: 400 }
      );
    }

    // Validar timezone básico
    if (!timezone.match(/^[A-Za-z_]+\/[A-Za-z_]+$/) && timezone !== "UTC") {
      return NextResponse.json(
        { error: "Timezone inválido. Formato esperado: Continent/City o UTC" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Verificar que el slug no existe
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingTenant) {
      return NextResponse.json(
        { error: "El slug ya existe. Por favor, elige otro." },
        { status: 400 }
      );
    }

    // 1. Crear tenant
    const { data: newTenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        timezone: timezone,
      })
      .select()
      .single();

    if (tenantError || !newTenant) {
      return NextResponse.json(
        { error: `Error al crear tenant: ${tenantError?.message || "Error desconocido"}` },
        { status: 500 }
      );
    }

    // 2. Crear o encontrar usuario owner en auth.users
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY no configurado" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Buscar usuario existente por email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === owner_email);

    let ownerUserId: string;

    if (existingUser) {
      ownerUserId = existingUser.id;
    } else {
      // Crear nuevo usuario (invitación por magic link)
      const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: owner_email,
        email_confirm: false, // Requiere confirmación por magic link
        user_metadata: {
          name: owner_name || owner_email.split("@")[0],
        },
      });

      if (userError || !newUser.user) {
        // Si falla, intentar rollback del tenant
        await supabase.from("tenants").delete().eq("id", newTenant.id);
        return NextResponse.json(
          { error: `Error al crear usuario: ${userError?.message || "Error desconocido"}` },
          { status: 500 }
        );
      }

      ownerUserId = newUser.user.id;

      // Enviar magic link de invitación
      try {
        const { error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: owner_email,
        });
        if (inviteError) {
          console.warn("No se pudo enviar magic link:", inviteError);
          // No crítico, continuar
        }
      } catch (e) {
        console.warn("Error al enviar magic link:", e);
        // No crítico, continuar
      }
    }

    // 3. Crear membership con role 'owner'
    const { error: membershipError } = await supabase
      .from("memberships")
      .insert({
        tenant_id: newTenant.id,
        user_id: ownerUserId,
        role: "owner",
      });

    if (membershipError) {
      // Rollback: eliminar tenant
      await supabase.from("tenants").delete().eq("id", newTenant.id);
      return NextResponse.json(
        { error: `Error al crear membership: ${membershipError.message}` },
        { status: 500 }
      );
    }

    // 4. Asignar plan si se especifica
    if (plan_key) {
      try {
        const { data: plan } = await supabase
          .schema("platform")
          .from("plans")
          .select("id")
          .eq("key", plan_key)
          .maybeSingle();

        if (plan) {
          await supabase
            .schema("platform")
            .from("org_plans")
            .insert({
              org_id: newTenant.id,
              plan_id: plan.id,
              billing_state: "active",
            });
        }
      } catch (e) {
        // No crítico, continuar
        console.warn("No se pudo asignar plan:", e);
      }
    }

    // 5. Auditar creación
    await supabase
      .schema("platform")
      .from("audit_logs")
      .insert({
        actor_id: currentUser.id,
        actor_type: "platform",
        scope: "platform",
        org_id: newTenant.id,
        action: "tenant_created",
        target_type: "tenant",
        target_id: newTenant.id,
        metadata: {
          name,
          slug,
          timezone,
          owner_email,
        },
      });

    return NextResponse.json({
      success: true,
      tenant: newTenant,
      owner_user_id: ownerUserId,
      message: existingUser
        ? "Tenant creado. El usuario ya existía y ha sido asignado como owner."
        : "Tenant creado. Se ha enviado un magic link al email del owner para activar su cuenta.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

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

        // KPIs desde org_metrics_daily (último día disponible)
        const today = new Date().toISOString().split("T")[0];
        const { data: latestMetrics } = await supabase
          .from("org_metrics_daily")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("metric_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        // KPIs básicos (fallback si no hay métricas)
        let bookingsCount = { count: 0 };
        let servicesCount = { count: 0 };
        let staffCount = { count: 0 };
        let bookingsToday = 0;

        if (latestMetrics) {
          // Usar métricas del último día disponible
          bookingsCount = { count: latestMetrics.total_bookings || 0 };
          servicesCount = { count: latestMetrics.active_services || 0 };
          staffCount = { count: latestMetrics.active_staff || 0 };
          
          // Reservas de hoy (si las métricas son de hoy)
          if (latestMetrics.metric_date === today) {
            bookingsToday = latestMetrics.confirmed_bookings || 0;
          } else {
            // Si no hay métricas de hoy, consultar directamente
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            const { count } = await supabase
              .from("bookings")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.id)
              .gte("starts_at", todayStart.toISOString())
              .lte("starts_at", todayEnd.toISOString());
            bookingsToday = count || 0;
          }
        } else {
          // Fallback: consultar directamente si no hay métricas
          const [bookingsResult, servicesResult, staffResult] = await Promise.all([
            supabase
              .from("bookings")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.id),
            supabase
              .from("services")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.id)
              .eq("active", true),
            supabase
              .from("staff")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.id)
              .eq("active", true),
          ]);
          bookingsCount = bookingsResult;
          servicesCount = servicesResult;
          staffCount = staffResult;

          // Reservas de hoy
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          const { count } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .gte("starts_at", todayStart.toISOString())
            .lte("starts_at", todayEnd.toISOString());
          bookingsToday = count || 0;
        }

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

