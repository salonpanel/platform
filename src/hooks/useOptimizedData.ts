"use client";

import { useStaleWhileRevalidate } from "./useStaleWhileRevalidate";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getCurrentTenant } from "@/lib/panel-tenant";

/**
 * Hook optimizado para Dashboard - obtiene tenant y datos en paralelo
 */
export function useDashboardData(impersonateOrgId: string | null) {
  const supabase = getSupabaseBrowser();

  // Obtener tenant + datos en UNA SOLA llamada con caché
  const { data, isLoading } = useStaleWhileRevalidate(
    `dashboard-full-${impersonateOrgId || 'default'}`,
    async () => {
      // 1. Obtener tenant primero
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      // 2. Todas las queries en paralelo
      const [bookingsRes, servicesRes, staffRes, upcomingRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, status", { count: "exact" })
          .eq("tenant_id", tenantId)
          .gte("starts_at", todayStart)
          .lte("starts_at", todayEnd),
        supabase
          .from("services")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("active", true),
        supabase
          .from("staff")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId)
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
          .eq("tenant_id", tenantId)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(5),
      ]);

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        kpis: {
          bookingsToday: bookingsRes.count || 0,
          activeServices: servicesRes.count || 0,
          activeStaff: staffRes.count || 0,
        },
        upcomingBookings: upcomingRes.data || [],
      };
    },
    { enabled: true } // Siempre habilitado, la lógica de tenant está dentro
  );

  return {
    tenant: data?.tenant || null,
    kpis: data?.kpis || { bookingsToday: 0, activeServices: 0, activeStaff: 0 },
    upcomingBookings: data?.upcomingBookings || [],
    isLoading,
  };
}

/**
 * Hook LEGACY - mantener para otras páginas que aún no migramos
 * TODO: Eliminar cuando todas las páginas usen el nuevo hook
 */
export function useDashboardDataLegacy(tenantId: string | null, timezone: string) {
  const supabase = getSupabaseBrowser();

  // KPIs básicos
  const { data: kpis, isLoading: kpisLoading } = useStaleWhileRevalidate(
    `dashboard-kpis-${tenantId}`,
    async () => {
      if (!tenantId) return null;

      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      // Todas las queries en paralelo
      const [bookingsRes, servicesRes, staffRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, status", { count: "exact" })
          .eq("tenant_id", tenantId)
          .gte("starts_at", todayStart)
          .lte("starts_at", todayEnd),
        supabase
          .from("services")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("active", true),
        supabase
          .from("staff")
          .select("id", { count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("active", true),
      ]);

      return {
        bookingsToday: bookingsRes.count || 0,
        activeServices: servicesRes.count || 0,
        activeStaff: staffRes.count || 0,
      };
    },
    { enabled: !!tenantId }
  );

  // Próximas reservas
  const { data: upcomingBookings, isLoading: bookingsLoading } = useStaleWhileRevalidate(
    `dashboard-upcoming-${tenantId}`,
    async () => {
      if (!tenantId) return [];

      const { data } = await supabase
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
        .eq("tenant_id", tenantId)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);

      return data || [];
    },
    { enabled: !!tenantId }
  );

  return {
    kpis: kpis || { bookingsToday: 0, activeServices: 0, activeStaff: 0 },
    upcomingBookings: upcomingBookings || [],
    isLoading: kpisLoading || bookingsLoading,
  };
}

/**
 * Hook optimizado para lista de clientes
 */
export function useCustomersData(tenantId: string | null) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `customers-${tenantId}`,
    async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      return data || [];
    },
    { enabled: !!tenantId, staleTime: 60000 } // 1 minuto
  );
}

/**
 * Hook optimizado para servicios
 */
export function useServicesData(tenantId: string | null) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `services-${tenantId}`,
    async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      return data || [];
    },
    { enabled: !!tenantId, staleTime: 120000 } // 2 minutos (cambian poco)
  );
}

/**
 * Hook optimizado para staff
 */
export function useStaffData(tenantId: string | null) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `staff-${tenantId}`,
    async () => {
      if (!tenantId) return [];

      const { data } = await supabase
        .from("staff")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      return data || [];
    },
    { enabled: !!tenantId, staleTime: 120000 } // 2 minutos
  );
}
