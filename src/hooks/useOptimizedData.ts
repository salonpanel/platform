"use client";

import { DashboardDataset, createEmptyDashboardKpis, fetchDashboardDataset } from "@/lib/dashboard-data";
import { fetchAgendaDataset, getAgendaRange } from "@/lib/agenda-data";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useStaleWhileRevalidate, useRealtimeStaleWhileRevalidate } from "./useStaleWhileRevalidate";
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

  // 🔥 REAL-TIME DASHBOARD: Actualiza automáticamente cuando llegan nuevas citas
  const cacheKey = options?.tenantId ? `dashboard-full-tenant-${options.tenantId}` : `dashboard-full-${impersonateOrgId || 'default'}`;

  const { data, isLoading } = useRealtimeStaleWhileRevalidate(
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
    // 🔥 CONFIGURACIÓN REAL-TIME: Escucha cambios en bookings y metrics
    {
      table: 'bookings',
      filter: options?.tenantId ? `tenant_id=eq.${options.tenantId}` : undefined,
      event: '*',
      tenantId: options?.tenantId || 'default',
      supabase: supabase,
    },
    {
      enabled: enabled && !!options?.tenantId,
      initialData: options?.initialData || undefined,
      persist: true,
      realtimeEnabled: true, // 🔥 HABILITADO: Actualiza en tiempo real
    }
  );

  return {
    tenant: data?.tenant || null,
    kpis: data?.kpis || createEmptyDashboardKpis(),
    upcomingBookings: data?.upcomingBookings || [],
    staffMembers: data?.staffMembers || [],
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
 * Hook optimizado para página de Servicios - usa get_services_filtered RPC
 */
export function useServicesPageData(
  impersonateOrgId: string | null,
  options?: { 
    status?: 'active' | 'inactive' | 'all';
    limit?: number;
    offset?: number;
  }
) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `services-page-${impersonateOrgId || 'default'}-${options?.status || 'all'}-${options?.offset || 0}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // 🚀 OPTIMIZACIÓN: Usar función RPC get_services_filtered con filtrado y paginación del servidor
      const { data: services, error } = await supabase.rpc('get_services_filtered', {
        p_tenant_id: tenantId,
        p_status: options?.status || 'all',
        p_limit: options?.limit || 100,
        p_offset: options?.offset || 0,
      });

      if (error) {
        console.error('[useServicesPageData] Error calling get_services_filtered:', error);
        throw error;
      }

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
 * Hook optimizado para página de Staff - usa get_staff_with_stats RPC
 */
export function useStaffPageData(
  impersonateOrgId: string | null,
  options?: {
    includeInactive?: boolean;
  }
) {
  const supabase = getSupabaseBrowser();

  return useStaleWhileRevalidate(
    `staff-page-${impersonateOrgId || 'default'}-${options?.includeInactive ? 'all' : 'active'}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // 🚀 OPTIMIZACIÓN: Usar función RPC get_staff_with_stats con estadísticas precalculadas
      const { data: staff, error } = await supabase.rpc('get_staff_with_stats', {
        p_tenant_id: tenantId,
        p_include_inactive: options?.includeInactive || false,
      });

      if (error) {
        console.error('[useStaffPageData] Error calling get_staff_with_stats:', error);
        throw error;
      }

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        staff: staff || [],
      };
    },
    { enabled: true }
  );
}

/**
 * Hook optimizado para página de Agenda - obtiene tenant + staff/services/customers/bookings/blockings/schedules
 * 🔥 AHORA CON REAL-TIME UPDATES
 */
export function useAgendaPageData(
  impersonateOrgId: string | null,
  options?: { selectedDate?: string; viewMode?: ViewMode; initialData?: any }
) {
  const supabase = getSupabaseBrowser();
  const selectedDate = options?.selectedDate || new Date().toISOString().slice(0, 10);
  const viewMode = options?.viewMode || "day";
  const range = getAgendaRange(selectedDate, viewMode);

  // 🔥 REAL-TIME AGENDA: Actualiza automáticamente cuando llegan cambios
  return useRealtimeStaleWhileRevalidate(
    `agenda-page-${impersonateOrgId || 'default'}-${range.viewMode}-${range.anchorDate}`,
    async () => {
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      return fetchAgendaDataset(supabase, tenant, range, { includeUserRole: true });
    },
    // 🔥 CONFIGURACIÓN REAL-TIME: Escucha cambios en agenda (bookings, blockings, etc.)
    {
      table: 'bookings',
      filter: `tenant_id=eq.${impersonateOrgId || 'default'}`, // TODO: Obtener tenantId real
      event: '*',
      tenantId: impersonateOrgId || 'default',
      supabase: supabase,
    },
    {
      enabled: true,
      staleTime: 60000, // 1 minuto para agenda (más agresivo)
      realtimeEnabled: true, // 🔥 HABILITADO: Actualiza en tiempo real
      initialData: options?.initialData
    }
  );
}

/**
 * Hook optimizado para página de Chat - obtiene tenant + conversaciones + miembros en paralelo
 * 🔥 AHORA CON REAL-TIME UPDATES
 */
export function useChatPageData(impersonateOrgId: string | null) {
  const supabase = getSupabaseBrowser();

  // 🔥 REAL-TIME CHAT: Actualiza automáticamente cuando llegan nuevos mensajes/conversaciones
  return useRealtimeStaleWhileRevalidate(
    `chat-page-${impersonateOrgId || 'default'}`,
    async () => {
      // 1. Obtener tenant
      const { tenant } = await getCurrentTenant(impersonateOrgId);
      if (!tenant) return null;

      const tenantId = tenant.id;

      // 2. Cargar datos en paralelo: conversaciones + miembros
      const [conversationsResult, membersResult] = await Promise.all([
        // Conversaciones optimizadas con RPC
        supabase.rpc("get_user_conversations_optimized", {
          p_user_id: null, // Se resolverá en la RPC
          p_tenant_id: tenantId,
        }),

        // Directorio de miembros
        supabase.rpc("list_tenant_members", { p_tenant_id: tenantId })
      ]);

      const conversations = conversationsResult.data || [];
      const members = membersResult.data || [];

      // Transformar miembros a formato de directorio
      const membersDirectory: Record<string, any> = {};
      for (const member of members) {
        membersDirectory[member.user_id] = {
          userId: member.user_id,
          displayName: member.display_name,
          tenantRole: member.tenant_role,
          profilePhotoUrl: member.avatar_url || undefined,
        };
      }

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name || "Tu barbería",
          timezone: tenant.timezone || "Europe/Madrid",
        },
        conversations: conversations.map((conv: any) => ({
          id: conv.id,
          tenantId: conv.tenant_id,
          type: conv.type as "all" | "direct" | "group",
          name: conv.name,
          lastMessageBody: conv.last_message_body,
          lastMessageAt: conv.last_message_at,
          unreadCount: conv.unread_count || 0,
          membersCount: conv.members_count || 0,
          lastReadAt: conv.last_read_at,
          createdBy: conv.created_by,
          viewerRole: conv.viewer_role as "member" | "admin",
        })),
        membersDirectory,
      };
    },
    // 🔥 CONFIGURACIÓN REAL-TIME: Escucha cambios en mensajes y conversaciones
    {
      table: 'team_messages',
      filter: `tenant_id=eq.${impersonateOrgId || 'default'}`, // TODO: Obtener tenantId real
      event: '*',
      tenantId: impersonateOrgId || 'default',
      supabase: supabase,
    },
    {
      enabled: true,
      staleTime: 30000, // 30 segundos (chat necesita ser más fresco)
      realtimeEnabled: true, // 🔥 HABILITADO: Actualiza en tiempo real
    }
  );
}
