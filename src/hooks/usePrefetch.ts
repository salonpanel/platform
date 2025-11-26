"use client";

import { useEffect } from "react";
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
export function usePrefetchData(tenantId: string | null) {
  useEffect(() => {
    if (!tenantId) return;

    // Precargar datos comunes en segundo plano
    const prefetchCommonData = async () => {
      // Esperar un momento para no interferir con la carga inicial
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Aquí puedes agregar precarga de datos comunes
      // Por ejemplo: staff, servicios, clientes recientes, etc.
      // fetch(`/api/staff?tenant_id=${tenantId}`);
      // fetch(`/api/services?tenant_id=${tenantId}`);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      requestIdleCallback(() => {
        prefetchCommonData();
      });
    } else {
      setTimeout(() => {
        prefetchCommonData();
      }, 2000);
    }
  }, [tenantId]);
}
