"use client";

import { useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { fetchDashboardDataset } from "@/lib/dashboard-data";
import { prefetchData, invalidateCache } from "./useStaleWhileRevalidate";

/**
 * Hook que mantiene los datos críticos calientes durante la sesión
 * Revalida periódicamente y responde a cambios en tiempo real
 */
export function useCacheWarmer(tenantId: string | null) {
  const supabase = getSupabaseBrowser();
  const warmingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Actualizar timestamp de actividad
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Función para mantener datos del dashboard frescos
  const warmDashboardCache = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { tenant } = await getCurrentTenant();
      if (!tenant) return;

      // Revalidar datos del dashboard
      const dashboardData = await fetchDashboardDataset(supabase, tenant);

      // Actualizar cache
      const cacheKey = `dashboard-full-tenant-${tenantId}`;
      await prefetchData(cacheKey, async () => dashboardData);

      console.log('[CacheWarmer] Dashboard cache warmed');
    } catch (error) {
      console.warn('[CacheWarmer] Error warming dashboard cache:', error);
    }
  }, [tenantId, supabase]);

  // Función para mantener datos de agenda frescos
  const warmAgendaCache = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { tenant } = await getCurrentTenant();
      if (!tenant) return;

      // Importar dinámicamente para evitar dependencias circulares
      const { fetchAgendaDataset, getAgendaRange } = await import("@/lib/agenda-data");

      const today = new Date().toISOString().slice(0, 10);
      const agendaRange = getAgendaRange(today, "day");
      const agendaData = await fetchAgendaDataset(supabase, tenant, agendaRange, { includeUserRole: true });

      // Actualizar cache
      const cacheKey = `agenda-page-${tenantId}-day-${today}`;
      await prefetchData(cacheKey, async () => agendaData);

      console.log('[CacheWarmer] Agenda cache warmed');
    } catch (error) {
      console.warn('[CacheWarmer] Error warming agenda cache:', error);
    }
  }, [tenantId, supabase]);

  // Setup de warming periódico
  useEffect(() => {
    if (!tenantId) return;

    // Warming inicial después de 30 segundos
    const initialWarmTimeout = setTimeout(async () => {
      console.log('[CacheWarmer] Starting initial cache warming...');
      await Promise.all([
        warmDashboardCache(),
        warmAgendaCache()
      ]);
    }, 30000); // 30 segundos después de montar

    // Warming periódico cada 2 minutos
    warmingIntervalRef.current = setInterval(async () => {
      // Solo si hay actividad reciente (últimos 10 minutos)
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity < 10 * 60 * 1000) { // 10 minutos
        console.log('[CacheWarmer] Periodic cache warming...');
        await Promise.all([
          warmDashboardCache(),
          warmAgendaCache()
        ]);
      }
    }, 2 * 60 * 1000); // Cada 2 minutos

    // Listeners de actividad
    const handleActivity = () => updateActivity();
    ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimeout(initialWarmTimeout);
      if (warmingIntervalRef.current) {
        clearInterval(warmingIntervalRef.current);
      }
      ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [tenantId, warmDashboardCache, warmAgendaCache, updateActivity]);

  // Función para forzar refresh inmediato
  const forceRefresh = useCallback(async () => {
    console.log('[CacheWarmer] Force refresh requested...');
    await Promise.all([
      warmDashboardCache(),
      warmAgendaCache()
    ]);
  }, [warmDashboardCache, warmAgendaCache]);

  return { forceRefresh };
}

// Función helper para obtener tenant actual
async function getCurrentTenant() {
  try {
    const supabase = getSupabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No user");

    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!membership?.tenant_id) throw new Error("No membership");

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, timezone")
      .eq("id", membership.tenant_id)
      .single();

    return { tenant };
  } catch (error) {
    console.error('[getCurrentTenant] Error:', error);
    return { tenant: null };
  }
}
