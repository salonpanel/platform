import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { fetchDashboardDataset } from "@/lib/dashboard-data";

/**
 * 🔥 API de prefetch inteligente para datos del panel
 * Se ejecuta después de verificación OTP exitosa para calentar datos críticos
 * Ahora usa datos preparados de la precarga progresiva
 */
export async function GET(req: NextRequest) {
  try {
    console.log("[PrefetchPanelData] 🔥 Iniciando prefetch inteligente de datos del panel...");

    // En Next.js 15+, cookies() retorna una Promise en route handlers y debe ser awaited
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verificar que tenemos sesión válida
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      console.log("[PrefetchPanelData] ❌ No hay sesión válida, abortando prefetch");
      return NextResponse.json(
        { ok: false, error: "No session" },
        { status: 401 }
      );
    }

    console.log("[PrefetchPanelData] ✅ Sesión válida encontrada, obteniendo tenant...");

    const sb = supabase;
    const { data: membership } = await sb
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!membership?.tenant_id) {
      console.log("[PrefetchPanelData] ❌ Usuario sin membership");
      return NextResponse.json(
        { ok: false, error: "No membership" },
        { status: 404 }
      );
    }

    console.log("[PrefetchPanelData] ✅ Tenant encontrado, obteniendo datos del panel...");

    const { data: tenant } = await sb
      .from("tenants")
      .select("id, name, timezone")
      .eq("id", membership.tenant_id)
      .single();

    if (!tenant) {
      console.log("[PrefetchPanelData] ❌ Tenant no encontrado");
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 }
      );
    }

    // 🔥 FETCH PARALELO DE DATOS CRÍTICOS DEL PANEL
    console.log("[PrefetchPanelData] 🚀 Ejecutando fetch paralelo de datos del dashboard...");
    const dashboardData = await fetchDashboardDataset(sb, tenant);

    if (!dashboardData) {
      console.log("[PrefetchPanelData] ❌ Error obteniendo datos del dashboard");
      return NextResponse.json(
        { ok: false, error: "Dashboard data fetch failed" },
        { status: 500 }
      );
    }

    console.log("[PrefetchPanelData] ✅ Datos del dashboard obtenidos exitosamente");

    // 🔥 PREPARAR RESPUESTA PARA CACHE DEL CLIENTE
    // El cliente leerá estos datos y los almacenará en sessionStorage
    const response = NextResponse.json({
      ok: true,
      data: dashboardData,
      timestamp: Date.now(),
      message: "Panel data prefetched successfully",
      // 🔥 META INFO: Ayuda al cliente a saber que estos datos vienen de prefetch inteligente
      source: "progressive-preload"
    });

    // Headers para optimizar cache
    response.headers.set('Cache-Control', 'private, max-age=5'); // Cache mínimo
    response.headers.set('X-Prefetch-Source', 'post-auth-verification');
    response.headers.set('X-Progressive-Load', 'true');

    console.log("[PrefetchPanelData] 🎉 Prefetch completado exitosamente - datos preparados para navegación instantánea");

    return response;

  } catch (error: any) {
    console.error("[PrefetchPanelData] ❌ Error en prefetch:", {
      error: error?.message,
      stack: error?.stack,
      code: error?.code,
      name: error?.name
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Prefetch failed",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
