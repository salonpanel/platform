"use client";

import { useEffect } from "react";
import { prefetchData } from "./useStaleWhileRevalidate";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { useRouter, usePathname } from "next/navigation";

/**
 * Hook para precargar rutas críticas del panel
 * Precarga las páginas más visitadas en segundo plano
 */
export function usePrefetchRoutes() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rutas críticas a precargar (las más usadas)
    const criticalRoutes = [
      "/panel",
      "/panel/agenda",
      "/panel/clientes",
      "/panel/servicios",
      "/panel/staff",
    ];

    // Rutas secundarias (menos prioritarias)
    const secondaryRoutes = [
      "/panel/monedero",
      "/panel/marketing",
      "/panel/chat",
      "/panel/ajustes",
    ];

    // Precargar rutas críticas inmediatamente
    const prefetchCritical = () => {
      criticalRoutes.forEach((route) => {
        if (route !== pathname) {
          router.prefetch(route);
        }
      });
    };

    // Precargar rutas secundarias después de un delay
    const prefetchSecondary = () => {
      setTimeout(() => {
        secondaryRoutes.forEach((route) => {
          if (route !== pathname) {
            router.prefetch(route);
          }
        });
      }, 1000); // 1 segundo después de cargar la página actual
    };

    // Ejecutar precarga cuando el usuario está en idle
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      requestIdleCallback(() => {
        prefetchCritical();
        prefetchSecondary();
      });
    } else {
      // Fallback si requestIdleCallback no está disponible
      setTimeout(() => {
        prefetchCritical();
        prefetchSecondary();
      }, 100);
    }
  }, [router, pathname]);
}

/**
 * Hook para precargar datos comunes en segundo plano
 * Precarga datos que se usan en múltiples páginas
 */
export function usePrefetchData(tenantId: string | null, impersonateOrgId: string | null = null) {
  useEffect(() => {
    // Precargar datos comunes en segundo plano
    const prefetchCommonData = async () => {
      // Try to wait for idle but don't delay too long — aim to prefetch early to warm critical caches
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Precargar dashboard data key using the same fetcher as useDashboardData
      const tenantPrefetch = async () => {
        // get tenant using same logic as hooks
        const { tenant } = await getCurrentTenant(impersonateOrgId);
        if (!tenant) return null;

        const supabase = getSupabaseBrowser();
        const tenantIdLocal = tenant.id;
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

        const [bookingsRes, servicesRes, staffRes, upcomingRes] = await Promise.all([
          supabase
            .from("bookings")
            .select("id", { head: true, count: "planned" })
            .eq("tenant_id", tenantIdLocal)
            .gte("starts_at", todayStart)
            .lte("starts_at", todayEnd),
          supabase
            .from("services")
            .select("id", { head: true, count: "planned" })
            .eq("tenant_id", tenantIdLocal)
            .eq("active", true),
          supabase
            .from("staff")
            .select("id", { head: true, count: "planned" })
            .eq("tenant_id", tenantIdLocal)
            .eq("active", true),
          supabase
            .from("bookings")
            .select(`
              id,
              starts_at,
              ends_at,
              status,
              customer:customers(name, email),
              service:services(name),
              staff:staff(name)
            `)
            .eq("tenant_id", tenantIdLocal)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(5),
        ]);

        return {
          tenant: { id: tenant.id, name: tenant.name || "Tu barbería", timezone: tenant.timezone || "Europe/Madrid" },
          kpis: { bookingsToday: bookingsRes.count || 0, activeServices: servicesRes.count || 0, activeStaff: staffRes.count || 0 },
          upcomingBookings: upcomingRes.data || [],
        };
      };

      // Prefetch the dashboard key so the first visit is instant
      prefetchData(`dashboard-full-${impersonateOrgId || 'default'}`, tenantPrefetch);
      // Also prefetch by tenant id key (if available) so client can hit same cache when tenantId is known
      try {
        const maybe = await tenantPrefetch();
        if (maybe?.tenant?.id) {
          prefetchData(`dashboard-full-tenant-${maybe.tenant.id}`, async () => maybe);
        }
      } catch (e) {
        // ignore
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      requestIdleCallback(() => {
        prefetchCommonData();
      });
    } else {
      setTimeout(() => {
        prefetchCommonData();
      }, 100);
    }
  }, [tenantId]);
}
