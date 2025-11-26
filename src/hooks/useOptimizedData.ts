"use client";

import { useStaleWhileRevalidate } from "./useStaleWhileRevalidate";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getCurrentTenant } from "@/lib/panel-tenant";

/**
 * Hook optimizado para Dashboard - obtiene tenant y datos en paralelo
 */
export function useDashboardData(impersonateOrgId: string | null, options?: { tenantId?: string | null; timezone?: string | null }) {
  const supabase = getSupabaseBrowser();

  // Obtener tenant + datos en UNA SOLA llamada con caché
  const cacheKey = options?.tenantId ? `dashboard-full-tenant-${options.tenantId}` : `dashboard-full-${impersonateOrgId || 'default'}`;

  const { data, isLoading } = useStaleWhileRevalidate(
    cacheKey,
    async () => {
      // 1. Obtener tenant primero (si se pasó por opciones, no llamamos a getCurrentTenant)
      let tenant = null as any;
      let tenantId: string | null = null;

      if (options?.tenantId) {
        tenantId = options.tenantId;
        tenant = { id: options.tenantId, name: "Tu barbería", timezone: options.timezone || "Europe/Madrid" };
      } else {
        const result = await getCurrentTenant(impersonateOrgId);
        if (!result?.tenant) return null;
        tenant = result.tenant;
        tenantId = tenant.id;
      }
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

      // 2. Todas las queries en paralelo
      const [bookingsRes, servicesRes, staffRes, upcomingRes] = await Promise.all([
        supabase
          .from("bookings")
          // Use planner/estimated count (faster) and head:true to avoid fetching rows here
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
export function useAgendaPageData(impersonateOrgId: string | null, selectedDate?: string) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `agenda-page-${impersonateOrgId || 'default'}-${selectedDate || 'today'}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // determine date range to prefetch bookings/blockings/schedules (default: selectedDate or today)
      const dateToLoad = selectedDate || new Date().toISOString().slice(0, 10);
      const startISO = new Date(new Date(dateToLoad).setHours(0, 0, 0, 0)).toISOString();
      const endISO = new Date(new Date(dateToLoad).setHours(23, 59, 59, 999)).toISOString();

      // Run queries in parallel
      const [staffRes, servicesRes, customersRes, bookingsRes, blockingsRes, schedulesRes] = await Promise.all([
        supabase
          .from("staff")
          .select("id, name, active")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name"),
        supabase
          .from("services")
          .select("id, name, duration_min, price_cents, buffer_min")
          .eq("tenant_id", tenantId)
          .eq("active", true)
          .order("name"),
        supabase
          .from("customers")
          .select("id, name, email, phone, notes")
          .eq("tenant_id", tenantId)
          .order("name")
          .limit(100),
        supabase
          .from("bookings")
          .select(`
            *,
            customer:customers(id, name, email, phone),
            service:services(id, name, duration_min, price_cents),
            staff:staff(id, name)
          `)
          .eq("tenant_id", tenantId)
          .gte("starts_at", startISO)
          .lte("starts_at", endISO)
          .order("starts_at"),
        supabase
          .from("staff_blockings")
          .select("*")
          .eq("tenant_id", tenantId)
          .gte("start_at", startISO)
          .lte("end_at", endISO)
          .order("start_at"),
        supabase
          .from("staff_schedules")
          .select("staff_id, start_time, end_time")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (bookingsRes.error) throw bookingsRes.error;
      if (blockingsRes.error) throw blockingsRes.error;
      if (schedulesRes.error) throw schedulesRes.error;

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        staff: staffRes.data || [],
        services: (servicesRes.data || []).map((s: any) => ({ ...s, buffer_min: s.buffer_min ?? 0 })),
        customers: customersRes.data || [],
        bookings: bookingsRes.data || [],
        blockings: blockingsRes.data || [],
        schedules: schedulesRes.data || [],
      };
    },
    { enabled: true, staleTime: 60000 }
  );
}
