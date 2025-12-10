"use client";

import { useEffect } from "react";
import { prefetchData } from "./useStaleWhileRevalidate";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { fetchAgendaDataset, getAgendaRange } from "@/lib/agenda-data";
import { useRouter, usePathname } from "next/navigation";

/**
 * Hook para precargar rutas críticas del panel
 * Precarga las páginas más visitadas en segundo plano
 */
export function usePrefetchRoutes() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Rutas críticas a precargar (ordenadas por prioridad de uso)
    const criticalRoutes = [
      "/panel/agenda", // 🔥 PRIORIDAD MÁXIMA - herramienta central
      "/panel",
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

    // Precargar rutas secundarias después de un delay mayor
    const prefetchSecondary = () => {
      setTimeout(() => {
        secondaryRoutes.forEach((route) => {
          if (route !== pathname) {
            router.prefetch(route);
          }
        });
      }, 2000); // 2 segundos después
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
 * Hook inteligente para precargar datos estratégicos
 * Detecta cuando la página actual está 100% cargada y precarga herramientas críticas
 * 🔥 PRIORIZA LA AGENDA como herramienta central
 */
export function useSmartPrefetchData(tenantId: string | null, impersonateOrgId: string | null = null) {
  useEffect(() => {
    if (!tenantId) return;

    // Función para detectar cuando la página está completamente cargada
    const waitForPageLoad = (): Promise<void> => {
      return new Promise((resolve) => {
        // Si ya está loaded, resolver inmediatamente
        if (document.readyState === 'complete') {
          resolve();
          return;
        }

        // Esperar al evento load
        const onLoad = () => {
          window.removeEventListener('load', onLoad);
          resolve();
        };
        window.addEventListener('load', onLoad);

        // Fallback timeout (máximo 3 segundos)
        setTimeout(resolve, 3000);
      });
    };

    // Función para detectar idle del navegador
    const waitForIdle = (): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          requestIdleCallback(() => resolve(), { timeout: 2000 });
        } else {
          // Fallback: esperar un poco
          setTimeout(resolve, 500);
        }
      });
    };

    // Función para detectar si hay actividad del usuario (no precargar si está interactuando)
    const isUserActive = (): boolean => {
      // Considerar usuario activo si ha habido interacción reciente (< 2 segundos)
      const lastInteraction = (window as any).__lastInteraction || 0;
      const now = Date.now();
      return (now - lastInteraction) < 2000;
    };

    // Listener para detectar actividad del usuario
    const updateLastInteraction = () => {
      (window as any).__lastInteraction = Date.now();
    };

    // Agregar listeners de interacción
    if (typeof window !== "undefined") {
      ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
        window.addEventListener(event, updateLastInteraction, { passive: true });
      });
    }

    // Estrategia de precarga inteligente
    const smartPrefetch = async () => {
      try {
        // 1. Esperar a que la página esté completamente cargada
        await waitForPageLoad();

        // 2. Esperar a que el navegador esté idle
        await waitForIdle();

        // 3. Verificar que el usuario no esté activo
        if (isUserActive()) {
          console.log('[SmartPrefetch] Usuario activo, postponiendo precarga...');
          setTimeout(smartPrefetch, 3000); // Reintentar en 3 segundos
          return;
        }

        console.log('[SmartPrefetch] Iniciando precarga inteligente...');

        const supabase = getSupabaseBrowser();
        const [{ tenant }, { data: { user } }] = await Promise.all([
          getCurrentTenant(impersonateOrgId),
          supabase.auth.getUser(),
        ]);
        if (!tenant || !user) return;

        const tenantIdLocal = tenant.id;

        // 🔥 PRIORIDAD 1: AGENDA (herramienta central) - Precargar datos completos
        console.log('[SmartPrefetch] 🔥 Precargando datos de AGENDA...');
        try {
          const agendaRange = getAgendaRange(new Date().toISOString().slice(0, 10), "day");
          const agendaData = await fetchAgendaDataset(supabase, tenant, agendaRange, { includeUserRole: true });

          prefetchData(`agenda-page-${impersonateOrgId || 'default'}-day-${new Date().toISOString().slice(0, 10)}`, async () => agendaData);
          console.log('[SmartPrefetch] ✅ Agenda precargada');
        } catch (error) {
          console.warn('[SmartPrefetch] Error precargando agenda:', error);
        }

        // 🔥 PRIORIDAD 1.5: CHAT - Precargar conversaciones optimizadas
        if (!isUserActive()) {
          console.log('[SmartPrefetch] 🔥 Precargando datos de CHAT...');
          try {
            // Usar la misma RPC que el componente optimizado
            const { data: conversationsData, error } = await supabase
              .rpc("get_user_conversations_optimized", {
                p_user_id: user.id,
                p_tenant_id: tenant.id,
              });

            if (!error && conversationsData) {
              prefetchData(`chat-conversations-${impersonateOrgId || 'default'}`, async () => conversationsData);
              console.log('[SmartPrefetch] ✅ Chat precargado');
            }
          } catch (error) {
            console.warn('[SmartPrefetch] Error precargando chat:', error);
          }
        }

        // Esperar un poco entre precargas pesadas
        await new Promise(resolve => setTimeout(resolve, 200));

        // PRIORIDAD 2: CLIENTES (datos importantes pero menos críticos que agenda)
        if (!isUserActive()) {
          console.log('[SmartPrefetch] Precargando datos de CLIENTES...');
          try {
            const customersData = await Promise.all([
              supabase
                .from("customers")
                .select("*")
                .eq("tenant_id", tenantIdLocal)
                .order("created_at", { ascending: false })
                .limit(50),
              // Obtener estadísticas de clientes
              supabase
                .from("bookings")
                .select("customer_id", { head: true, count: "exact" })
                .eq("tenant_id", tenantIdLocal)
                .not("customer_id", "is", null)
            ]);

            prefetchData(`customers-page-${impersonateOrgId || 'default'}`, async () => ({
              tenant,
              customers: customersData[0].data || [],
            }));
            console.log('[SmartPrefetch] ✅ Clientes precargados');
          } catch (error) {
            console.warn('[SmartPrefetch] Error precargando clientes:', error);
          }
        }

        // PRIORIDAD 3: SERVICIOS (menos críticos, pero útiles)
        if (!isUserActive()) {
          await new Promise(resolve => setTimeout(resolve, 300));
          console.log('[SmartPrefetch] Precargando datos de SERVICIOS...');
          try {
            const servicesData = await supabase
              .from("services")
              .select("*")
              .eq("tenant_id", tenantIdLocal)
              .order("name");

            prefetchData(`services-page-${impersonateOrgId || 'default'}`, async () => ({
              tenant,
              services: servicesData.data || [],
            }));
            console.log('[SmartPrefetch] ✅ Servicios precargados');
          } catch (error) {
            console.warn('[SmartPrefetch] Error precargando servicios:', error);
          }
        }

        // PRIORIDAD 4: STAFF (menos crítico, pero útil para agenda)
        if (!isUserActive()) {
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[SmartPrefetch] Precargando datos de STAFF...');
          try {
            const staffData = await supabase
              .from("staff")
              .select(`
                *,
                bookings_count:bookings(count)
              `)
              .eq("tenant_id", tenantIdLocal)
              .order("name");

            prefetchData(`staff-page-${impersonateOrgId || 'default'}`, async () => ({
              tenant,
              staff: (staffData.data || []).map(s => ({
                ...s,
                bookings_count: Array.isArray(s.bookings_count) ? s.bookings_count.length : 0,
              })),
            }));
            console.log('[SmartPrefetch] ✅ Staff precargado');
          } catch (error) {
            console.warn('[SmartPrefetch] Error precargando staff:', error);
          }
        }

        console.log('[SmartPrefetch] 🎉 Precarga inteligente completada');

      } catch (error) {
        console.warn('[SmartPrefetch] Error en precarga inteligente:', error);
      }
    };

    // Iniciar precarga inteligente
    smartPrefetch();

    // Cleanup
    return () => {
      if (typeof window !== "undefined") {
        ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
          window.removeEventListener(event, updateLastInteraction);
        });
      }
    };
  }, [tenantId, impersonateOrgId]);
}
