"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Hook para precarga progresiva inteligente
 * Precarga componentes e interfaz mientras usuario está en login
 */
export function useProgressivePreload() {
  const preloadStartedRef = useRef(false);
  const dataPreloadStartedRef = useRef(false);

  // Fase 1: Precargar componentes críticos del panel
  const preloadPanelComponents = useCallback(async () => {
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;

    console.log('[ProgressivePreload] 🔥 Iniciando precarga de componentes del panel...');

    // Usar requestIdleCallback para no bloquear el hilo principal
    const preloadComponents = async () => {
      try {
        // Precargar componentes críticos del dashboard - usando imports seguros
        const dashboardImports = [
          import('@/components/panel/MiniKPI'),
          import('@/components/panel/UpcomingAppointments'),
          import('@/components/panel/MessagesWidget'),
        ];

        // Precargar componentes de navegación
        const navImports = [
          import('@/components/panel/SidebarNav'),
          import('@/components/panel/MobileBottomNav'),
        ];

        // Ejecutar precargas en lotes para no sobrecargar
        const batch1 = Promise.all(dashboardImports);
        await batch1;
        console.log('[ProgressivePreload] ✅ Componentes del dashboard precargados');

        const batch2 = Promise.all(navImports);
        await batch2;
        console.log('[ProgressivePreload] ✅ Componentes de navegación precargados');

        console.log('[ProgressivePreload] 🎉 Todos los componentes críticos precargados');

      } catch (error) {
        console.warn('[ProgressivePreload] Error en precarga de componentes:', error);
        // No es crítico, continuar normalmente
      }
    };

    // Ejecutar cuando el navegador esté idle
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      requestIdleCallback(() => preloadComponents(), { timeout: 2000 });
    } else {
      // Fallback para navegadores sin requestIdleCallback
      setTimeout(preloadComponents, 100);
    }
  }, []);

  // Fase 2: Precargar datos específicos una vez tenemos el email
  const preloadUserData = useCallback(async (email: string) => {
    if (dataPreloadStartedRef.current || !email) return;
    dataPreloadStartedRef.current = true;

    console.log('[ProgressivePreload] 🔥 Iniciando precarga de datos para:', email);

    try {
      // Hacer una petición ligera para "preparar" la sesión
      // Esto puede incluir: verificar si el usuario existe, preparar tenant info, etc.
      const response = await fetch('/api/preload/user-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
        // No incluir credenciales ya que aún no estamos autenticados
      });

      if (response.ok) {
        console.log('[ProgressivePreload] ✅ Datos de usuario preparados');
      } else {
        console.log('[ProgressivePreload] ℹ️ Usuario no encontrado o error (esperado)');
      }

    } catch (error) {
      console.warn('[ProgressivePreload] Error en precarga de datos:', error);
    }
  }, []);

  // Iniciar precarga de componentes cuando se monta el hook
  useEffect(() => {
    preloadPanelComponents();
  }, [preloadPanelComponents]);

  return {
    preloadUserData,
    isComponentsPreloaded: preloadStartedRef.current,
    isDataPreloaded: dataPreloadStartedRef.current,
  };
}

/**
 * Hook simplificado para páginas que necesitan precargar componentes específicos
 */
export function useComponentPreload(componentImports: (() => Promise<any>)[]) {
  const preloadStartedRef = useRef(false);

  const preloadComponents = useCallback(async () => {
    if (preloadStartedRef.current || componentImports.length === 0) return;
    preloadStartedRef.current = true;

    console.log(`[ComponentPreload] Precargando ${componentImports.length} componentes...`);

    try {
      // Ejecutar precargas en paralelo pero con límite para no sobrecargar
      const batches = [];
      const batchSize = 3;

      for (let i = 0; i < componentImports.length; i += batchSize) {
        const batch = componentImports.slice(i, i + batchSize);
        batches.push(Promise.all(batch.map(imp => imp())));
      }

      // Ejecutar lotes secuencialmente
      for (const batch of batches) {
        await batch;
        // Pequeña pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('[ComponentPreload] ✅ Componentes precargados');

    } catch (error) {
      console.warn('[ComponentPreload] Error en precarga:', error);
    }
  }, [componentImports]);

  useEffect(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      requestIdleCallback(() => preloadComponents(), { timeout: 1000 });
    } else {
      setTimeout(preloadComponents, 100);
    }
  }, [preloadComponents]);

  return { isPreloaded: preloadStartedRef.current };
}
