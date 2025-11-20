/**
 * Helpers de SEO - BookFast Platform
 * 
 * Funciones para generar URLs canónicas y metadatos SEO
 * según el contexto de dominio.
 */

import { AppContext } from "@/lib/domains";
import { getMarketingUrl, getProUrl, getAdminUrl, URLS } from "@/lib/urls";

/**
 * Obtiene la URL canónica para una ruta según el contexto
 * 
 * @param path - Ruta relativa (ej: "/panel/agenda")
 * @param context - Contexto de la aplicación
 * @returns URL canónica completa
 * 
 * @example
 * getCanonicalUrl("/panel/agenda", "pro") // "https://pro.bookfast.es/panel/agenda"
 * getCanonicalUrl("/", "marketing") // "https://bookfast.es/"
 * getCanonicalUrl("/", "tenantPublic") // "https://barberstudio.bookfast.es/"
 */
export function getCanonicalUrl(
  path: string,
  context: "marketing" | "pro" | "admin" | "tenantPublic",
  tenantSubdomain?: string
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  switch (context) {
    case "pro":
      return getProUrl(cleanPath);
    case "admin":
      return getAdminUrl(cleanPath);
    case "marketing":
      return getMarketingUrl(cleanPath);
    case "tenantPublic":
      // Para tenants, necesitamos el subdominio
      if (tenantSubdomain) {
        const isProd = process.env.NODE_ENV === "production";
        const base = isProd
          ? `https://${tenantSubdomain}.bookfast.es`
          : `http://${tenantSubdomain}.bookfast.es.localtest.me:3000`;
        return `${base}${cleanPath}`;
      }
      // Fallback a marketing si no hay subdominio
      return getMarketingUrl(cleanPath);
    default:
      return getMarketingUrl(cleanPath);
  }
}

/**
 * Determina si una ruta debe ser indexada por motores de búsqueda
 * 
 * Reglas:
 * - Marketing: indexable (cuando esté implementado)
 * - Portal público de tenant: indexable
 * - Panel (/panel/*): NO indexable
 * - Admin (/admin/*): NO indexable
 * 
 * @param path - Ruta a verificar
 * @param context - Contexto de la aplicación
 * @returns true si la ruta debe ser indexada
 */
export function shouldIndexRoute(path: string, context: AppContext): boolean {
  // Panel y admin nunca deben ser indexados
  if (path.startsWith("/panel") || path.startsWith("/admin")) {
    return false;
  }

  // Rutas internas de autenticación no deben ser indexadas
  if (path.startsWith("/auth") || path.startsWith("/login") || path.startsWith("/logout")) {
    return false;
  }

  // Portal público de tenant: indexable
  if (context === "tenantPublic" && path.startsWith("/r/")) {
    return true;
  }

  // Marketing: indexable (cuando esté implementado)
  if (context === "marketing") {
    // Por ahora, solo indexar la home (cuando exista)
    return path === "/";
  }

  // Por defecto, no indexar
  return false;
}

/**
 * Obtiene la configuración de robots para una ruta
 * 
 * @param path - Ruta a verificar
 * @param context - Contexto de la aplicación
 * @returns Configuración de robots
 */
export function getRobotsConfig(path: string, context: AppContext) {
  const shouldIndex = shouldIndexRoute(path, context);

  return {
    index: shouldIndex,
    follow: shouldIndex,
    nocache: !shouldIndex,
    googleBot: {
      index: shouldIndex,
      follow: shouldIndex,
      noimageindex: !shouldIndex,
      "max-video-preview": shouldIndex ? 0 : -1,
      "max-snippet": shouldIndex ? 0 : -1,
    },
  };
}


