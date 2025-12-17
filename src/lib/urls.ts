/**
 * Configuración centralizada de URLs - BookFast Platform
 * 
 * Helpers para construir URLs según el contexto de dominio.
 * 
 * IMPORTANTE: En desarrollo, usa localtest.me para simular subdominios.
 * En producción, usa los dominios reales.
 */

import { AppContext, getBaseUrlForContext } from "@/lib/domains";

const isProd = process.env.NODE_ENV === "production";

/**
 * URLs base de los dominios según el entorno
 */
export const URLS = {
  PRO_BASE: isProd
    ? "https://pro.bookfast.es"
    : "http://pro.bookfast.es.localtest.me:3000",
  ADMIN_BASE: isProd
    ? "https://admin.bookfast.es"
    : "http://admin.bookfast.es.localtest.me:3000",
  ROOT: isProd
    ? "https://bookfast.es"
    : "http://localhost:3000",
} as const;

/**
 * URL de callback para autenticación
 * Por ahora, todos los logins redirigen a pro.bookfast.es
 */
export const AUTH_REDIRECT = `${URLS.PRO_BASE}/auth/callback`;

/**
 * Obtiene la URL base según el contexto de la aplicación
 * 
 * @param context - Contexto: 'pro', 'admin', o 'marketing'
 * @returns URL base del dominio
 */
export function getAppBaseUrl(context: "pro" | "admin" | "marketing"): string {
  return getBaseUrlForContext(context, process.env.NODE_ENV === "production");
}

/**
 * Obtiene la URL de callback para autenticación según el contexto
 * 
 * Por ahora, el panel solo vive en pro.bookfast.es
 * En el futuro, se puede extender para otros contextos
 * 
 * @param context - Contexto de la aplicación
 * @returns URL de callback para auth
 */
export function getAuthRedirectUrl(context?: AppContext): string {
  // Usar constante centralizada
  return AUTH_REDIRECT;
  
  // TODO: En el futuro, si hay login desde portal público o marketing,
  // ajustar esta lógica según el contexto
  // Ejemplo futuro:
  // if (context === "tenantPublic") {
  //   const subdomain = parseSubdomain(host);
  //   return `https://${subdomain}.bookfast.es/auth/callback`;
  // }
}

/**
 * Obtiene la URL de login según el contexto
 * 
 * @param context - Contexto de la aplicación
 * @returns URL de login
 */
export function getLoginUrl(context?: AppContext): string {
  // Usar constante centralizada
  return `${URLS.PRO_BASE}/login`;
  
  // TODO: En el futuro, si hay login desde portal público o marketing,
  // ajustar esta lógica según el contexto
}

/**
 * Obtiene la URL base del dominio marketing
 * 
 * @param path - Ruta opcional a añadir
 * @returns URL completa del dominio marketing
 */
export function getMarketingUrl(path?: string): string {
  const base = URLS.ROOT;
  if (!path) return base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Obtiene la URL base del dominio pro (panel)
 * 
 * @param path - Ruta opcional a añadir
 * @returns URL completa del dominio pro
 */
export function getProUrl(path?: string): string {
  const base = URLS.PRO_BASE;
  if (!path) return base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Obtiene la URL base del dominio admin
 * 
 * @param path - Ruta opcional a añadir
 * @returns URL completa del dominio admin
 */
export function getAdminUrl(path?: string): string {
  const base = URLS.ADMIN_BASE;
  if (!path) return base;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

