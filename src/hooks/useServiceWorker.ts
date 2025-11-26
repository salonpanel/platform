"use client";

import { useEffect } from "react";

/**
 * Hook para registrar el Service Worker y habilitar caché de assets
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
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
            console.error("❌ Error al registrar Service Worker:", error);
          });
      });

      // Escuchar cambios en el Service Worker
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("🔄 Service Worker actualizado");
      });
    }
  }, []);
}
