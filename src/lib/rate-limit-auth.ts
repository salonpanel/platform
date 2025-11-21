/**
 * Rate Limiting para Autenticación
 * 
 * Este módulo implementa rate limiting robusto en el servidor
 * para prevenir ataques de fuerza bruta en el sistema de autenticación.
 * 
 * IMPORTANTE: Requiere configurar Upstash Redis
 * 
 * Instalación:
 * npm install @upstash/ratelimit @upstash/redis
 * 
 * Variables de entorno requeridas:
 * UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
 * UPSTASH_REDIS_REST_TOKEN=your-token
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Configuración de Redis
const redis = Redis.fromEnv();

/**
 * Rate limiter para login (envío de OTP)
 * Límite: 5 intentos cada 15 minutos por email
 */
export const loginRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    analytics: true,
    prefix: "ratelimit:login",
});

/**
 * Rate limiter para verificación de OTP
 * Límite: 10 intentos cada 15 minutos por email
 * (Más permisivo porque el usuario puede equivocarse al escribir el código)
 */
export const verifyOtpRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    analytics: true,
    prefix: "ratelimit:verify-otp",
});

/**
 * Rate limiter por IP (global)
 * Límite: 20 intentos cada hora por IP
 * Previene ataques distribuidos
 */
export const ipRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    analytics: true,
    prefix: "ratelimit:ip",
});

/**
 * Verifica rate limit para login
 * 
 * @param identifier - Email del usuario
 * @returns { success: boolean, limit: number, reset: number, remaining: number }
 */
export async function checkLoginRateLimit(identifier: string) {
    const { success, limit, reset, remaining } = await loginRateLimit.limit(
        identifier.toLowerCase().trim()
    );

    return {
        success,
        limit,
        reset,
        remaining,
        retryAfter: success ? 0 : Math.ceil((reset - Date.now()) / 1000),
    };
}

/**
 * Verifica rate limit para verificación de OTP
 * 
 * @param identifier - Email del usuario
 * @returns { success: boolean, limit: number, reset: number, remaining: number }
 */
export async function checkVerifyOtpRateLimit(identifier: string) {
    const { success, limit, reset, remaining } = await verifyOtpRateLimit.limit(
        identifier.toLowerCase().trim()
    );

    return {
        success,
        limit,
        reset,
        remaining,
        retryAfter: success ? 0 : Math.ceil((reset - Date.now()) / 1000),
    };
}

/**
 * Verifica rate limit por IP
 * 
 * @param ip - IP del cliente
 * @returns { success: boolean, limit: number, reset: number, remaining: number }
 */
export async function checkIpRateLimit(ip: string) {
    const { success, limit, reset, remaining } = await ipRateLimit.limit(ip);

    return {
        success,
        limit,
        reset,
        remaining,
        retryAfter: success ? 0 : Math.ceil((reset - Date.now()) / 1000),
    };
}

/**
 * Obtiene la IP del cliente desde los headers
 * Soporta proxies y load balancers (Vercel, Cloudflare, etc.)
 * 
 * @param headers - Headers de la request
 * @returns IP del cliente
 */
export function getClientIp(headers: Headers): string {
    // Prioridad de headers para obtener la IP real del cliente
    const forwardedFor = headers.get('x-forwarded-for');
    const realIp = headers.get('x-real-ip');
    const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare
    const vercelForwardedFor = headers.get('x-vercel-forwarded-for'); // Vercel

    // x-forwarded-for puede contener múltiples IPs separadas por comas
    // La primera es la IP real del cliente
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }

    // Cloudflare
    if (cfConnectingIp) {
        return cfConnectingIp;
    }

    // Vercel
    if (vercelForwardedFor) {
        return vercelForwardedFor;
    }

    // x-real-ip
    if (realIp) {
        return realIp;
    }

    // Fallback: IP desconocida
    return 'unknown';
}

/**
 * Ejemplo de uso en un API route:
 * 
 * ```typescript
 * import { checkLoginRateLimit, getClientIp } from '@/lib/rate-limit-auth';
 * 
 * export async function POST(req: NextRequest) {
 *   const body = await req.json();
 *   const email = body.email;
 *   
 *   // Verificar rate limit por email
 *   const emailLimit = await checkLoginRateLimit(email);
 *   if (!emailLimit.success) {
 *     return NextResponse.json(
 *       { 
 *         error: `Demasiados intentos. Por favor espera ${emailLimit.retryAfter} segundos.`,
 *         retryAfter: emailLimit.retryAfter,
 *       },
 *       { status: 429 }
 *     );
 *   }
 *   
 *   // Verificar rate limit por IP
 *   const ip = getClientIp(req.headers);
 *   const ipLimit = await checkIpRateLimit(ip);
 *   if (!ipLimit.success) {
 *     return NextResponse.json(
 *       { 
 *         error: `Demasiados intentos desde esta IP. Por favor espera ${ipLimit.retryAfter} segundos.`,
 *         retryAfter: ipLimit.retryAfter,
 *       },
 *       { status: 429 }
 *     );
 *   }
 *   
 *   // Continuar con la lógica de autenticación...
 * }
 * ```
 */
