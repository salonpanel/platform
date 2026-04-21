/**
 * Rate limiting específico del asistente.
 *
 * Tres buckets encadenados que se comprueban en este orden:
 *  1) Por IP  — defensa contra DDoS.
 *  2) Por user — un user no puede saturar al tenant completo.
 *  3) Por tenant — un tenant no puede saturar a la plataforma.
 *
 * Si cualquiera falla: 429 + security_event.
 *
 * Reusa el cliente Upstash existente (mismo patrón que src/lib/rate-limit.ts).
 * Si Upstash no está configurado (env faltante), los limiters devuelven null
 * y el endpoint decide qué hacer (en dev local → dejar pasar; en prod → bloquear).
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = Redis.fromEnv();
}

/**
 * Por IP: 20 peticiones por minuto.
 * Defensa cruda contra saturación desde una sola IP sin auth.
 */
export const asistenteRateLimitByIp = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: false,
      prefix: "asistente:ratelimit:ip",
    })
  : null;

/**
 * Por user: 30 peticiones por minuto, 200 por hora.
 * Uso normal de chat casi nunca se acerca. Si sube de aquí: probable abuso
 * o loop del cliente.
 */
export const asistenteRateLimitByUser = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: false,
      prefix: "asistente:ratelimit:user",
    })
  : null;

export const asistenteRateLimitByUserHourly = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "1 h"),
      analytics: false,
      prefix: "asistente:ratelimit:user:h",
    })
  : null;

/**
 * Por tenant: 500 peticiones por hora. Frena un tenant que se desboque
 * aunque sus users sean legítimos.
 */
export const asistenteRateLimitByTenant = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, "1 h"),
      analytics: false,
      prefix: "asistente:ratelimit:tenant",
    })
  : null;

/**
 * Outbound WhatsApp rate limit — límite para envíos salientes del asistente
 * por tenant (además del propio rate limit de Meta).
 */
export const whatsappOutboundRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "1 h"),
      analytics: false,
      prefix: "asistente:whatsapp:tenant",
    })
  : null;

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  limit?: number;
  remaining?: number;
  resetAt?: number;
}

/**
 * Comprueba los 3 buckets encadenados para un turno de chat.
 * Si alguno falla: devuelve { allowed: false, reason: "ip"|"user"|"user_hourly"|"tenant" }.
 */
export async function checkChatRateLimits(opts: {
  ip: string;
  userId: string;
  tenantId: string;
}): Promise<RateLimitCheck> {
  const { ip, userId, tenantId } = opts;

  if (asistenteRateLimitByIp) {
    const r = await asistenteRateLimitByIp.limit(ip);
    if (!r.success) {
      return {
        allowed: false,
        reason: "ip",
        limit: r.limit,
        remaining: r.remaining,
        resetAt: r.reset,
      };
    }
  }

  if (asistenteRateLimitByUser) {
    const r = await asistenteRateLimitByUser.limit(userId);
    if (!r.success) {
      return {
        allowed: false,
        reason: "user",
        limit: r.limit,
        remaining: r.remaining,
        resetAt: r.reset,
      };
    }
  }

  if (asistenteRateLimitByUserHourly) {
    const r = await asistenteRateLimitByUserHourly.limit(userId);
    if (!r.success) {
      return {
        allowed: false,
        reason: "user_hourly",
        limit: r.limit,
        remaining: r.remaining,
        resetAt: r.reset,
      };
    }
  }

  if (asistenteRateLimitByTenant) {
    const r = await asistenteRateLimitByTenant.limit(tenantId);
    if (!r.success) {
      return {
        allowed: false,
        reason: "tenant",
        limit: r.limit,
        remaining: r.remaining,
        resetAt: r.reset,
      };
    }
  }

  return { allowed: true };
}

/**
 * Está Upstash disponible?
 * Útil para bloquear en producción si no lo está (fail-safe).
 */
export function isRateLimitAvailable(): boolean {
  return redis !== null;
}
