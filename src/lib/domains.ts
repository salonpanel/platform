/**
 * Sistema de Contexto por Dominio - BookFast Platform
 * 
 * Determina el contexto de la aplicación basado en el host/dominio:
 * - marketing: bookfast.es (web comercial)
 * - pro: pro.bookfast.es (panel de barberos)
 * - admin: admin.bookfast.es (consola de administración)
 * - tenantPublic: {tenant}.bookfast.es (portal público de reservas)
 */

export type AppContext = "marketing" | "pro" | "admin" | "tenantPublic" | "unknown";

/**
 * Subdominios reservados que no pueden ser usados por tenants
 * 
 * Lista completa de subdominios que están reservados para uso interno
 * de la plataforma y no pueden ser asignados a tenants.
 */
export const RESERVED_SUBDOMAINS = [
  "",
  "www",
  "pro",
  "admin",
  "api",
  "static",
  "cdn",
  "mail",
  "smtp",
  "app",
  "www2",
  "ftp",
  "localhost",
  "staging",
  "dev",
  "test",
  "auth",
  "admin-panel",
  "dashboard",
  "panel",
] as const;

const RESERVED_SUBDOMAINS_SET = new Set<string>(RESERVED_SUBDOMAINS);

/**
 * Extrae el subdominio de un host
 * 
 * @param host - Host completo (ej: "pro.bookfast.es" o "localhost:3000")
 * @returns Subdominio extraído o null si no hay subdominio
 * 
 * @example
 * parseSubdomain("pro.bookfast.es") // "pro"
 * parseSubdomain("barberstudio.bookfast.es") // "barberstudio"
 * parseSubdomain("localhost:3000") // null
 * parseSubdomain("bookfast.es") // null
 */
export function parseSubdomain(host: string): string | null {
  // Remover puerto si existe (localhost:3000 -> localhost)
  const hostWithoutPort = host.split(":")[0];

  // En desarrollo, localhost no tiene subdominio
  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") {
    return null;
  }

  // En producción, extraer subdominio de bookfast.es
  const parts = hostWithoutPort.split(".");
  
  // Si tiene al menos 3 partes (subdominio.bookfast.es)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Verificar que el dominio base sea bookfast.es
    const domainBase = parts.slice(-2).join(".");
    if (domainBase === "bookfast.es") {
      return subdomain;
    }
  }

  return null;
}

/**
 * Verifica si un subdominio está reservado
 * 
 * @param subdomain - Subdominio a verificar
 * @returns true si el subdominio está reservado
 */
export function isReservedSubdomain(subdomain: string): boolean {
  if (!subdomain) return true;
  return RESERVED_SUBDOMAINS_SET.has(subdomain.toLowerCase());
}

/**
 * Valida si un slug de tenant es válido
 * 
 * Reglas:
 * - Mínimo 3 caracteres, máximo 32 caracteres
 * - Solo letras minúsculas, números y guiones
 * - No puede empezar ni terminar en guion
 * - No puede ser un subdominio reservado
 * 
 * @param slug - Slug a validar
 * @returns true si el slug es válido
 * 
 * @example
 * isValidTenantSlug("barberstudio") // true
 * isValidTenantSlug("pro") // false (reservado)
 * isValidTenantSlug("mi-barberia") // true
 * isValidTenantSlug("-invalid") // false (empieza con guion)
 */
export function isValidTenantSlug(slug: string): boolean {
  if (!slug || slug.trim().length === 0) {
    return false;
  }

  const trimmedSlug = slug.trim().toLowerCase();

  // Verificar longitud: mínimo 3, máximo 32 caracteres
  if (trimmedSlug.length < 3 || trimmedSlug.length > 32) {
    return false;
  }

  // Verificar formato: solo letras minúsculas, números y guiones
  // No puede empezar ni terminar en guion
  if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(trimmedSlug)) {
    return false;
  }

  // Verificar que no sea un subdominio reservado
  if (isReservedSubdomain(trimmedSlug)) {
    return false;
  }

  return true;
}

/**
 * Determina el contexto de la aplicación basado en el host
 * 
 * @param host - Host completo de la request
 * @returns Contexto de la aplicación
 * 
 * @example
 * getAppContextFromHost("pro.bookfast.es") // "pro"
 * getAppContextFromHost("admin.bookfast.es") // "admin"
 * getAppContextFromHost("barberstudio.bookfast.es") // "tenantPublic"
 * getAppContextFromHost("bookfast.es") // "marketing"
 * getAppContextFromHost("localhost:3000") // "pro" (default en desarrollo)
 */
export function getAppContextFromHost(host: string): AppContext {
  const subdomain = parseSubdomain(host);

  // En desarrollo (localhost), por defecto es "pro" (panel)
  if (!subdomain) {
    // Si es localhost, asumimos que es el panel por defecto
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return "pro";
    }
    // Si no hay subdominio en producción, es el dominio raíz (marketing)
    return "marketing";
  }

  // Subdominios reservados específicos
  if (subdomain === "pro") {
    return "pro";
  }

  if (subdomain === "admin") {
    return "admin";
  }

  // Si el subdominio no está reservado, es un tenant público
  if (!isReservedSubdomain(subdomain)) {
    return "tenantPublic";
  }

  // Por defecto, desconocido
  return "unknown";
}

/**
 * Resuelve el tenant a partir del host
 * 
 * @param host - Host completo de la request
 * @returns Slug e ID del tenant, o null si no se puede resolver
 * 
 * @example
 * resolveTenantByHost("barberstudio.bookfast.es") // { slug: "barberstudio", id: "uuid..." }
 * resolveTenantByHost("localhost:3000") // null (en desarrollo)
 */
export async function resolveTenantByHost(host: string): Promise<{ slug: string; id: string } | null> {
  const subdomain = parseSubdomain(host);

  // En desarrollo, no resolvemos por host (se usa /r/[orgId] directamente)
  if (!subdomain || host.includes("localhost") || host.includes("127.0.0.1")) {
    return null;
  }

  // Si es un subdominio reservado, no es un tenant
  if (isReservedSubdomain(subdomain)) {
    return null;
  }

  // Consultar Supabase para obtener el tenant por slug
  try {
    // Importación dinámica para evitar problemas de circular dependency
    const { getSupabaseServer } = await import("./supabase/server");
    const supabase = getSupabaseServer();

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id, slug")
      .eq("slug", subdomain)
      .maybeSingle();

    if (error) {
      console.error("[resolveTenantByHost] Error consultando tenant:", error);
      return null;
    }

    if (!tenant) {
      // Tenant no encontrado
      return null;
    }

    return {
      slug: tenant.slug,
      id: tenant.id,
    };
  } catch (err) {
    console.error("[resolveTenantByHost] Error:", err);
    // Fallback: asumir que el subdominio es el slug (sin ID)
    // Esto permite que funcione aunque falle la consulta
    return {
      slug: subdomain,
      id: "", // ID vacío indica que no se pudo resolver
    };
  }
}

/**
 * Obtiene la URL base del dominio según el contexto
 * 
 * @param context - Contexto de la aplicación
 * @param isProduction - Si está en producción
 * @returns URL base del dominio
 */
export function getBaseUrlForContext(
  context: AppContext,
  isProduction: boolean = process.env.NODE_ENV === "production"
): string {
  if (!isProduction) {
    return "http://localhost:3000";
  }

  switch (context) {
    case "pro":
      return "https://pro.bookfast.es";
    case "admin":
      return "https://admin.bookfast.es";
    case "marketing":
      return "https://bookfast.es";
    case "tenantPublic":
      // No podemos determinar la URL sin el tenant específico
      return "https://bookfast.es";
    default:
      return "https://bookfast.es";
  }
}

