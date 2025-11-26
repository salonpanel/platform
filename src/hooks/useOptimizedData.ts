"use client";

import { DashboardDataset, createEmptyDashboardKpis, fetchDashboardDataset } from "@/lib/dashboard-data";
import { fetchAgendaDataset, getAgendaRange } from "@/lib/agenda-data";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useStaleWhileRevalidate } from "./useStaleWhileRevalidate";
import { ViewMode } from "@/types/agenda";

/**
 * Hook optimizado para Dashboard - obtiene tenant y datos en paralelo
 */
export function useDashboardData(
  impersonateOrgId: string | null,
  options?: { tenantId?: string | null; tenant?: any; timezone?: string | null; initialData?: DashboardDataset | null; enabled?: boolean }
) {
  const supabase = getSupabaseBrowser();

  const enabled = options?.enabled ?? true;

  // Obtener tenant + datos en UNA SOLA llamada con caché
  const cacheKey = options?.tenantId ? `dashboard-full-tenant-${options?.tenantId}` : `dashboard-full-${impersonateOrgId || 'default'}`;

  const { data, isLoading } = useStaleWhileRevalidate(
    cacheKey,
    async () => {
      // 1. Obtener tenant primero (si se pasó por opciones, no llamamos a getCurrentTenant)
      let tenant = null as any;

      if (options?.tenant) {
        // Si ya tenemos tenant completo desde contexto, usarlo directamente
        tenant = options.tenant;
      } else if (options?.tenantId) {
        tenant = { id: options.tenantId, name: "Tu barbería", timezone: options.timezone || "Europe/Madrid" };
      } else {
        const result = await getCurrentTenant(impersonateOrgId);
        if (!result?.tenant) return null;
        tenant = result.tenant;
      }

      return fetchDashboardDataset(supabase, tenant);
    },
    { enabled: enabled && !!options?.tenantId, initialData: options?.initialData || undefined, persist: true } // Solo ejecutar cuando tenemos tenantId y está habilitado
  );

  return {
    tenant: data?.tenant || null,
    kpis: data?.kpis || createEmptyDashboardKpis(),
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
          .select("id", { head: true, count: "planned" })
          .eq("tenant_id", tenantId)
          .gte("starts_at", todayStart)
          .lte("starts_at", todayEnd),
        supabase
          .from("services")
          .select("id", { head: true, count: "planned" })
          .eq("tenant_id", tenantId)
          .eq("active", true),
        supabase
          .from("staff")
          .select("id", { head: true, count: "planned" })
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
 * Hook optimizado para página de Clientes - obtiene tenant + clientes en paralelo
 */
export function useCustomersPageData(impersonateOrgId: string | null) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `customers-page-${impersonateOrgId || 'default'}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // 2. Cargar clientes en paralelo
      const { data: customers, error } = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        customers: customers || [],
      };
    },
    { enabled: true }
  );
}

/**
 * Hook optimizado para página de Servicios - obtiene tenant + servicios en paralelo
 */
export function useServicesPageData(impersonateOrgId: string | null) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `services-page-${impersonateOrgId || 'default'}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // 2. Cargar servicios
      const { data: services, error } = await supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        services: services || [],
      };
    },
    { enabled: true }
  );
}

/**
 * Hook optimizado para página de Staff - obtiene tenant + staff en paralelo
 */
export function useStaffPageData(impersonateOrgId: string | null) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `staff-page-${impersonateOrgId || 'default'}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // 2. Cargar staff con estadísticas
      const { data: staff, error } = await supabase
        .from("staff")
        .select(`
          *,
          bookings_count:bookings(count)
        `)
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        staff: (staff || []).map(s => ({
          ...s,
          bookings_count: Array.isArray(s.bookings_count) ? s.bookings_count.length : 0,
        })),
      };
    },
    { enabled: true }
  );
}

/**
 * Hook optimizado para página de Agenda - obtiene tenant + staff/services/customers/bookings/blockings/schedules
 */
export function useAgendaPageData(
  impersonateOrgId: string | null,
  options?: { selectedDate?: string; viewMode?: ViewMode; initialData?: any }
) {
  const supabase = getSupabaseBrowser();
  const selectedDate = options?.selectedDate || new Date().toISOString().slice(0, 10);
  const viewMode = options?.viewMode || "day";
  const range = getAgendaRange(selectedDate, viewMode);

  return useStaleWhileRevalidate(
    `agenda-page-${impersonateOrgId || 'default'}-${range.viewMode}-${range.anchorDate}`,
    async () => {
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      return fetchAgendaDataset(supabase, tenant, range, { includeUserRole: true });
    },
    { enabled: true, staleTime: 60000, initialData: options?.initialData }
  );
}
