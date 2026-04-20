"use client";

import { useEffect } from "react";

// Enable the service worker:
//   • Always in production (NODE_ENV === "production")
//   • In development only when NEXT_PUBLIC_ENABLE_SERVICE_WORKER=true is set
//   • Can be explicitly disabled with NEXT_PUBLIC_ENABLE_SERVICE_WORKER=false
const ENABLE_SERVICE_WORKER = (() => {
  const explicit = process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER;
  if (explicit === "false" || explicit === "0") return false;
  if (explicit === "true"  || explicit === "1") return true;
  // Default: on in production, off in development
  return process.env.NODE_ENV === "production";
})();

/**
 * Registers the Service Worker (/public/sw.js) to enable:
 *   - Offline page caching
 *   - Push notification delivery
 *   - Faster repeat loads via static asset cache
 */
export function useServiceWorker() {
  useEffect(() => {
    if (!ENABLE_SERVICE_WORKER) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          // Update SW in the background without forcing a reload
          updateViaCache: "none",
        });

        // Check for updates every 5 minutes (not on every interaction)
        const UPDATE_INTERVAL_MS = 5 * 60 * 1000;
        const timer = setInterval(() => registration.update(), UPDATE_INTERVAL_MS);

        // When a new SW takes control, we reload once so users get fresh code
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        return () => clearInterval(timer);
      } catch (err) {
        // Don't surface SW errors to the user — it's a progressive enhancement
        if (process.env.NODE_ENV !== "production") {
          console.warn("[SW] Registration failed:", err);
        }
      }
    };

    // Wait for the page to be fully loaded before registering
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);
}
