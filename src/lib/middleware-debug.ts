/**
 * Utilidades de depuración para middleware - BookFast Platform
 * 
 * Logs solo en desarrollo (NODE_ENV !== 'production')
 */

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Log de depuración del dominio (solo en desarrollo)
 */
export function logDomainDebug(
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isDevelopment) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = "[MIDDLEWARE-DEBUG]";
  
  if (data) {
    console.log(`${prefix} [${timestamp}] ${message}`, data);
  } else {
    console.log(`${prefix} [${timestamp}] ${message}`);
  }
}

/**
 * Log de resolución de tenant (solo en desarrollo)
 */
export function logTenantResolution(
  host: string,
  tenant: { slug: string; id: string } | null,
  success: boolean
): void {
  if (!isDevelopment) {
    return;
  }

  if (success && tenant) {
    logDomainDebug(`✅ Tenant resuelto para ${host}`, {
      slug: tenant.slug,
      id: tenant.id.substring(0, 8) + "...",
    });
  } else {
    logDomainDebug(`❌ No se pudo resolver tenant para ${host}`);
  }
}

