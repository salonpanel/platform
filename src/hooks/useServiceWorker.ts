"use client";

import { useEffect } from "react";

const ENABLE_SERVICE_WORKER =
  process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "true" ||
  process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "1";

/**
 * Hook para registrar el Service Worker y habilitar caché de assets
 */
export function useServiceWorker() {
  useEffect(() => {
    if (!ENABLE_SERVICE_WORKER) {
      return;
    }

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Verificar que el service worker existe antes de intentar registrarlo
      fetch("/sw.js", { method: "HEAD" })
        .then((response) => {
          if (!response.ok) {
            console.warn("[ServiceWorker] sw.js no encontrado (404), saltando registro");
            return;
          }

          // Registrar el Service Worker después de que la página cargue
          window.addEventListener("load", () => {
            navigator.serviceWorker
              .register("/sw.js")
              .then((registration) => {
                console.log("✅ Service Worker registrado:", registration.scope);

                // Verificar actualizaciones periódicamente
                setInterval(() => {
                  registration.update();
                }, 60000); // Cada 60 segundos
              })
              .catch((error) => {
                // Solo loggear errores que no sean 404 (ya verificamos que existe)
                if (!error.message?.includes("404")) {
                  console.error("❌ Error al registrar Service Worker:", error);
                }
              });
          });
        })
        .catch(() => {
          // Silenciar errores de fetch para sw.js - no existe, no hay problema
        });

      // Escuchar cambios en el Service Worker
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("🔄 Service Worker actualizado");
      });
    }
  }, []);
}
