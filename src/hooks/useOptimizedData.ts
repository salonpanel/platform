"use client";

import { DashboardDataset, createEmptyDashboardKpis, fetchDashboardDataset } from "@/lib/dashboard-data";
import { fetchAgendaDataset, getAgendaRange } from "@/lib/agenda-data";
// import { getCurrentTenant } from "@/lib/panel-tenant"; // Phase 13.1.3: Removed direct usage
import { useTenant } from "@/contexts/TenantContext"; // Phase 13.1.2 Unified Context
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
  const { tenant: contextTenant } = useTenant();

  // Resolve tenant: Context > Options > null
  const activeTenantId = contextTenant?.id || options?.tenantId;
  const activeTenant = contextTenant || options?.tenant;

  const enabled = (options?.enabled ?? true) && !!activeTenantId;

  // 🔥 REAL-TIME DASHBOARD: Actualiza automáticamente cuando llegan nuevas citas
  // Key depends on the resolved tenant ID
  const cacheKey = activeTenantId
    ? `dashboard-full-tenant-${activeTenantId}-${impersonateOrgId || 'own'}`
    : null;

  const { data, isLoading } = useRealtimeStaleWhileRevalidate(
    cacheKey,
    async () => {
      if (!activeTenantId) return null;
      const safeTenantId = activeTenantId as string;

      // 1. Fetch using the resolved tenant directly
      // Fallback object construction if context provides partial data (unlikely) or just ID passed in options
      const tenantObj = activeTenant || { id: safeTenantId, name: "Tu barbería", timezone: options?.timezone || "Europe/Madrid" };

      return fetchDashboardDataset(supabase, tenantObj);
    },
    // 🔥 CONFIGURACIÓN REAL-TIME: Escucha cambios en bookings y metrics
    {
      table: 'bookings',
      filter: activeTenantId ? `tenant_id=eq.${activeTenantId}` : undefined,
      event: '*',
      tenantId: activeTenantId || 'default',
      supabase: supabase,
    },
    {
      enabled: enabled,
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
          service:services!bookings_service_id_fkey(name),
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
export function useCustomersPageData(
  impersonateOrgId: string | null,
  options?: { initialData?: any; enabled?: boolean }
) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useTenant();
  const activeTenantId = tenant?.id;

  const enabled = (options?.enabled ?? true) && !!activeTenantId;

  return useStaleWhileRevalidate(
    activeTenantId ? `customers-page-${activeTenantId}` : null,
    async () => {
      // 1. Obtener tenant
      if (!activeTenantId || !tenant) throw new Error("No tenant in context");

      const tenantId = activeTenantId as string;

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
    { enabled }
  );
}

/**
 * Hook optimizado para página de Servicios - usa get_services_filtered RPC
 * Con fallback a query directa si la función no existe
 */
export function useServicesPageData(
  impersonateOrgId: string | null,
  options?: {
    status?: 'active' | 'inactive' | 'all';
    limit?: number;
    offset?: number;
    enabled?: boolean;
  }
) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useTenant();
  const activeTenantId = tenant?.id;

  const enabled = (options?.enabled ?? true) && !!activeTenantId;

  // Key depends on resolved tenant
  const cacheKey = activeTenantId
    ? `services-page-${activeTenantId}-${options?.status || 'all'}-${options?.offset || 0}`
    : null;

  return useStaleWhileRevalidate(
    cacheKey,
    async () => {
      // 1. Check Tenant
      if (!activeTenantId || !tenant) throw new Error("No tenant in context");

      const tenantId = activeTenantId as string;

      // 🚀 OPTIMIZACIÓN: Intentar usar función RPC manage_list_services
      const { data: servicesRpc, error: rpcError } = await supabase.rpc('manage_list_services', {
        p_tenant_id: tenantId,
        p_status: options?.status || 'all',
        p_category: null, // Initial load fetches all categories
        p_search_term: null,
      });

      // Si la función RPC existe y funciona, usarla
      if (!rpcError && servicesRpc) {
        return {
          tenant: {
            id: tenant.id,
            name: tenant.name || "Tu barbería",
            timezone: tenant.timezone || "Europe/Madrid",
          },
          services: servicesRpc || [],
        };
      }

      // 🔄 FALLBACK: Si la función no existe, usar query directa
      if (rpcError) {
        console.warn('[useServicesPageData] RPC not available, using direct query:', rpcError);
      }

      let query = supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      // Aplicar filtro de status si no es 'all'
      if (options?.status === 'active') {
        query = query.eq('active', true);
      } else if (options?.status === 'inactive') {
        query = query.eq('active', false);
      }

      // Aplicar paginación
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options?.limit || 100) - 1);
      }

      const { data: services, error } = await query;

      if (error) {
        console.error('[useServicesPageData] Error in direct query:', error);
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
    { enabled }
  );
}

/**
 * Hook optimizado para página de Staff - usa get_staff_with_stats RPC
 * Con fallback a query directa si la función no existe
 */
export function useStaffPageData(
  impersonateOrgId: string | null,
  options?: {
    includeInactive?: boolean;
    enabled?: boolean;
  }
) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useTenant();
  const activeTenantId = tenant?.id;

  const enabled = (options?.enabled ?? true) && !!activeTenantId;

  // Key depends on resolved tenant
  const cacheKey = activeTenantId
    ? `staff-page-${activeTenantId}-${options?.includeInactive ? 'all' : 'active'}`
    : null;

  return useStaleWhileRevalidate(
    cacheKey,
    async () => {
      // 1. Obtener tenant
      if (!activeTenantId || !tenant) throw new Error("No tenant in context");

      const tenantId = activeTenantId as string;

      // 🚀 OPTIMIZACIÓN: Intentar usar función RPC get_staff_with_stats
      const { data: staffRpc, error: rpcError } = await supabase.rpc('get_staff_with_stats', {
        p_tenant_id: tenantId,
        p_include_inactive: options?.includeInactive || false,
      });

      // Si la función RPC existe y funciona, usarla
      if (!rpcError && staffRpc) {
        return {
          tenant: {
            id: tenant.id,
            name: tenant.name || "Tu barbería",
            timezone: tenant.timezone || "Europe/Madrid",
          },
          staff: staffRpc || [],
        };
      }

      // 🔄 FALLBACK: Si la función no existe, usar query directa
      if (rpcError) {
        console.warn('[useStaffPageData] RPC not available, using direct query:', rpcError);
      }

      let query = supabase
        .from("staff")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });

      // Filtrar por activos si no se incluyen inactivos
      if (!options?.includeInactive) {
        query = query.eq('active', true);
      }

      const { data: staff, error } = await query;

      if (error) {
        console.error('[useStaffPageData] Error in direct query:', error);
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
    { enabled }
  );
}

/**
 * Hook optimizado para página de Agenda - obtiene tenant + staff/services/customers/bookings/blockings/schedules
 * 🔥 AHORA CON REAL-TIME UPDATES
 */
export function useAgendaPageData(
  impersonateOrgId: string | null,
  options?: { selectedDate?: string; viewMode?: ViewMode; initialData?: any; enabled?: boolean }
) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useTenant();
  const activeTenantId = tenant?.id;

  const selectedDate = options?.selectedDate || new Date().toISOString().slice(0, 10);
  const viewMode = options?.viewMode || "day";
  const range = getAgendaRange(selectedDate, viewMode);

  const enabled = (options?.enabled ?? true) && !!activeTenantId;

  // 🔥 REAL-TIME AGENDA: Actualiza automáticamente cuando llegan cambios
  return useRealtimeStaleWhileRevalidate(
    activeTenantId
      ? `agenda-page-${activeTenantId}-${range.viewMode}-${range.anchorDate}`
      : null,
    async () => {
      if (!tenant) return null;

      // Uses tenant from closure, NO getCurrentTenant
      return fetchAgendaDataset(supabase, tenant, range, { includeUserRole: true });
    },
    // 🔥 CONFIGURACIÓN REAL-TIME: Escucha cambios en agenda (bookings, blockings, etc.)
    {
      table: 'bookings',
      filter: activeTenantId ? `tenant_id=eq.${activeTenantId}` : undefined,
      event: '*',
      tenantId: activeTenantId || 'default',
      supabase: supabase,
    },
    {
      enabled: enabled,
      staleTime: 60000,
      realtimeEnabled: true,
      initialData: options?.initialData
    }
  );
}

/**
 * Hook optimizado para página de Chat - obtiene tenant + conversaciones + miembros en paralelo
 * 🔥 AHORA CON REAL-TIME UPDATES
 */
export function useChatPageData(
  impersonateOrgId: string | null,
  options?: { initialData?: any; enabled?: boolean }
) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useTenant();
  const activeTenantId = tenant?.id;

  const enabled = (options?.enabled ?? true) && !!activeTenantId;

  // 🔥 REAL-TIME CHAT: Actualiza automáticamente cuando llegan nuevos mensajes/conversaciones
  return useRealtimeStaleWhileRevalidate(
    activeTenantId ? `chat-page-${activeTenantId}` : null,
    async () => {
      // 1. Obtener tenant
      if (!activeTenantId || !tenant) return null;

      const tenantId = activeTenantId as string;

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
      filter: activeTenantId ? `tenant_id=eq.${activeTenantId}` : undefined,
      event: '*',
      tenantId: activeTenantId || 'default',
      supabase: supabase,
    },
    {
      enabled: enabled,
      staleTime: 30000, // 30 segundos (chat necesita ser más fresco)
      realtimeEnabled: true, // 🔥 HABILITADO: Actualiza en tiempo real
      initialData: options?.initialData
    }
  );
}
