/**
 * Configuración centralizada de URLs - BookFast Platform
 * 
 * Helpers para construir URLs según el contexto de dominio
 */

import { AppContext, getBaseUrlForContext } from "@/lib/domains";

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
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    return "http://localhost:3000/auth/callback";
  }

  // Por ahora, todos los logins redirigen a pro.bookfast.es
  // TODO: En el futuro, si hay login desde portal público o marketing,
  // ajustar esta lógica según el contexto
  // Ejemplo futuro:
  // if (context === "tenantPublic") {
  //   return `https://${subdomain}.bookfast.es/auth/callback`;
  // }
  
  return "https://pro.bookfast.es/auth/callback";
}

/**
 * Obtiene la URL de login según el contexto
 * 
 * @param context - Contexto de la aplicación
 * @returns URL de login
 */
export function getLoginUrl(context?: AppContext): string {
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    return "http://localhost:3000/login";
  }

  // Por ahora, todos los logins van a pro.bookfast.es
  // TODO: En el futuro, si hay login desde portal público o marketing,
  // ajustar esta lógica según el contexto
  
  return "https://pro.bookfast.es/login";
}

/**
 * Obtiene la URL base del dominio marketing
 */
export function getMarketingUrl(): string {
  const isProduction = process.env.NODE_ENV === "production";
  return isProduction ? "https://bookfast.es" : "http://localhost:3000";
}




