"use client";

import { DashboardDataset, createEmptyDashboardKpis, fetchDashboardDataset } from "@/lib/dashboard-data";
import { fetchAgendaDataset, getAgendaRange } from "@/lib/agenda-data";
import { useTenant } from "@/contexts/TenantContext"; // Phase 13.1.2 Unified Context
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { useCallback, useMemo } from "react";
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
      const tenantObj = activeTenant || { id: safeTenantId, name: "Tu negocio", timezone: options?.timezone || "Europe/Madrid" };

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
  impersonateOrgId?: string | null,
  options?: { initialData?: any; enabled?: boolean }
) {
  const supabase = getSupabaseBrowser();
  const { tenant } = useTenant();
  const activeTenantId = tenant?.id ?? null;
  const effectiveTenantId = impersonateOrgId ?? activeTenantId;

  const enabled = (options?.enabled ?? true) && !!effectiveTenantId;

  return useStaleWhileRevalidate(
    effectiveTenantId ? `customers-page-${effectiveTenantId}` : null,
    async () => {
      // 1. Obtener tenant
      if (!effectiveTenantId) throw new Error("No tenant available");
      const tenantId = effectiveTenantId as string;

      // Si estamos impersonando (o el layout aún no resolvió ese tenant), cargar tenant desde DB
      let resolvedTenant = tenant ?? null;
      if (!resolvedTenant || resolvedTenant.id !== tenantId) {
        const { data: t, error: tError } = await supabase
          .from("tenants")
          .select("id, name, timezone")
          .eq("id", tenantId)
          .maybeSingle();

        if (tError) throw tError;
        if (!t) throw new Error("No tienes acceso a este negocio");

        resolvedTenant = {
          ...(resolvedTenant as any),
          id: t.id,
          name: (t as any).name,
          timezone: (t as any).timezone,
        };
      }

      // 2. Cargar clientes en paralelo
      const { data: customers, error } = await supabase
        .from("customers")
        .select(
          `
          id,
          name,
          full_name,
          email,
          phone,
          created_at,
          notes,
          internal_notes,
          visits_count,
          last_booking_at,
          total_spent_cents,
          is_vip,
          is_banned,
          marketing_opt_in
        `,
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalizedCustomers = (customers || []).map((c: any) => {
        const derivedSegment: "normal" | "vip" | "banned" | "marketing" | "no_contact" =
          c?.is_banned
            ? "banned"
            : c?.is_vip
              ? "vip"
              : (!c?.email && !c?.phone)
                ? "no_contact"
                : c?.marketing_opt_in
                  ? "marketing"
                  : "normal";

        return {
          id: String(c.id),
          name: (c.full_name || c.name || "Cliente") as string,
          email: (c.email || undefined) as string | undefined,
          phone: (c.phone || undefined) as string | undefined,
          segment: derivedSegment,
          visitCount: Number(c.visits_count ?? 0),
          lastVisit: (c.last_booking_at || undefined) as string | undefined,
          totalSpent: c.total_spent_cents !== null && c.total_spent_cents !== undefined
            ? Number(c.total_spent_cents)
            : undefined,
          created_at: String(c.created_at),
          notes: (c.notes ?? null) as string | null,
          internal_notes: (c.internal_notes ?? null) as string | null,
        };
      });

      return {
        tenant: {
          id: resolvedTenant!.id,
          name: resolvedTenant!.name || "Tu negocio",
          timezone: resolvedTenant!.timezone || "Europe/Madrid",
        },
        customers: normalizedCustomers,
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

      // 🚀 OPTIMIZACIÓN: Intentar usar función RPC manage_list_services (firma endurecida)
      const { data: servicesRpc, error: rpcError } = await supabase.rpc(
        "manage_list_services",
        {
          p_tenant_id: tenantId,
          p_status: options?.status || "all",
          p_category: null, // Initial load fetches all categories
          p_search_term: null,
          p_sort_by: "name",
          p_sort_direction: "asc",
          p_min_price_cents: null,
          p_max_price_cents: null,
          p_buffer_filter: "all",
        }
      );

      // Si la función RPC existe y funciona, usarla
      if (!rpcError && servicesRpc) {
        return {
          tenant: {
            id: tenant.id,
            name: tenant.name || "Tu negocio",
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
          name: tenant.name || "Tu negocio",
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

  // Nota: para Staff necesitamos soportar impersonación igual que otras páginas (Chat, etc.)
  // sin depender solo del TenantContext.
  const enabled = options?.enabled ?? true;

  // Key depends on requested tenant (own vs impersonated)
  const cacheKey =
    tenant?.id || impersonateOrgId
      ? `staff-page-${impersonateOrgId || tenant?.id}-${options?.includeInactive ? "all" : "active"}`
      : null;

  return useStaleWhileRevalidate(
    cacheKey,
    async () => {
      // 1. Resolver tenant actual (con impersonación si aplica)
      const { tenant: resolvedTenant, status } = await getCurrentTenant(
        impersonateOrgId
      );

      if (status !== "OK" || !resolvedTenant) {
        throw new Error("No tenant available");
      }

      const tenantId = resolvedTenant.id;

      // 🚀 OPTIMIZACIÓN: Intentar usar función RPC get_staff_with_stats
      const { data: staffRpc, error: rpcError } = await supabase.rpc('get_staff_with_stats', {
        p_tenant_id: tenantId,
        p_include_inactive: options?.includeInactive || false,
      });

      // Si la función RPC existe y funciona, usarla
      if (!rpcError && staffRpc) {
        return {
          tenant: {
            id: resolvedTenant.id,
            name: resolvedTenant.name || "Tu negocio",
            timezone: resolvedTenant.timezone || "Europe/Madrid",
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
          id: resolvedTenant.id,
          name: resolvedTenant.name || "Tu negocio",
          timezone: resolvedTenant.timezone || "Europe/Madrid",
        },
        staff: staff || [],
      };
    },
    { enabled: enabled && (!!tenant?.id || !!impersonateOrgId) }
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

  const cacheKey = useMemo(() => {
    if (impersonateOrgId) return `chat-page-imp-${impersonateOrgId}`;
    if (tenant?.id) return `chat-page-${tenant.id}`;
    return null;
  }, [impersonateOrgId, tenant?.id]);

  const realtimeTenantId = impersonateOrgId || tenant?.id || null;

  const enabled =
    (options?.enabled ?? true) && (!!tenant?.id || !!impersonateOrgId);

  const fetchChatPage = useCallback(async () => {
    const { tenant: resolvedTenant, status } = await getCurrentTenant(
      impersonateOrgId
    );
    if (status !== "OK" || !resolvedTenant) return null;

    const tenantId = resolvedTenant.id;

    const [conversationsResult, membersResult] = await Promise.all([
      supabase.rpc("get_user_conversations_optimized", {
        p_user_id: null,
        p_tenant_id: tenantId,
      }),
      supabase.rpc("list_tenant_members", { p_tenant_id: tenantId }),
    ]);

    if (conversationsResult.error) throw conversationsResult.error;
    if (membersResult.error) throw membersResult.error;

    const conversations = conversationsResult.data || [];
    const members = membersResult.data || [];

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
        id: resolvedTenant.id,
        name: resolvedTenant.name || "Tu negocio",
        timezone: resolvedTenant.timezone || "Europe/Madrid",
        logoUrl: resolvedTenant.logoUrl ?? null,
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
        lastMessageSenderId: conv.last_message_sender_id,
        lastMessageSenderName: conv.last_message_sender_name ?? null,
        targetUserId: conv.target_user_id,
      })),
      membersDirectory,
    };
  }, [impersonateOrgId, supabase]);

  return useRealtimeStaleWhileRevalidate(
    cacheKey,
    fetchChatPage,
    {
      table: "team_messages",
      filter: realtimeTenantId ? `tenant_id=eq.${realtimeTenantId}` : undefined,
      event: "*",
      tenantId: realtimeTenantId || "default",
      supabase: supabase,
    },
    {
      enabled: enabled,
      staleTime: 30000,
      // El realtime de mensajes vive en TeamChatOptimized (un solo canal); evitar doble suscripción aquí.
      realtimeEnabled: false,
      initialData: options?.initialData,
    }
  );
}
