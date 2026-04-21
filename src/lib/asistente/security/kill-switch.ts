/**
 * Kill switches del asistente.
 *
 * Dos niveles:
 *  - global: lo controla platform admin. Una sola fila (scope='global').
 *  - tenant: lo controla el owner del tenant. Una por tenant.
 *
 * Los flags granulares (whatsapp, bulk_writes, refunds, chat) viven en
 * feature_flags JSONB para permitir apagar capacidades concretas sin
 * desactivar el chat entero.
 *
 * Cache: respuesta cacheada en memoria durante CACHE_TTL_MS (10s) para
 * no ir a la BD en cada request. Corto para que la propagación del kill
 * switch sea casi inmediata.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CACHE_TTL_MS = 10_000;

export type AsistenteCapability = "chat" | "whatsapp" | "bulk_writes" | "refunds";

interface CachedSwitch {
  enabled: boolean;
  flags: Record<string, boolean>;
  reason?: string;
  expiresAt: number;
}

const cache = new Map<string, CachedSwitch>();

function cacheKey(scope: "global" | "tenant", tenantId?: string) {
  return scope === "global" ? "global" : `tenant:${tenantId}`;
}

async function loadSwitch(
  scope: "global" | "tenant",
  tenantId?: string,
): Promise<CachedSwitch> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("asistente_kill_switches")
    .select("enabled, feature_flags, reason")
    .eq("scope", scope);

  if (scope === "tenant") {
    query = query.eq("tenant_id", tenantId ?? "");
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    // Ante duda, fail-SAFE (bloqueamos).
    // En desarrollo local, si la tabla todavía no existe, habrá error; el
    // endpoint debe manejar ese caso y decidir. Aquí devolvemos "no row"
    // interpretado como enabled=true (sin switch).
    if (error.code === "PGRST116" || error.code === "42P01") {
      return {
        enabled: true,
        flags: defaultFlags(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
    }
    return {
      enabled: false,
      flags: defaultFlags(),
      reason: "kill_switch_read_error",
      expiresAt: Date.now() + 2_000,
    };
  }

  if (!data) {
    // No hay fila → IA habilitada.
    return {
      enabled: true,
      flags: defaultFlags(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  }

  const row = data as {
    enabled: boolean;
    feature_flags: Record<string, boolean> | null;
    reason: string | null;
  };

  return {
    enabled: row.enabled === true,
    flags: { ...defaultFlags(), ...(row.feature_flags ?? {}) },
    reason: row.reason ?? undefined,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
}

function defaultFlags(): Record<string, boolean> {
  return {
    chat: true,
    whatsapp: true,
    bulk_writes: true,
    refunds: true,
  };
}

async function getSwitch(
  scope: "global" | "tenant",
  tenantId?: string,
): Promise<CachedSwitch> {
  const key = cacheKey(scope, tenantId);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached;
  }
  const fresh = await loadSwitch(scope, tenantId);
  cache.set(key, fresh);
  return fresh;
}

export interface KillSwitchResult {
  allowed: boolean;
  reason?: string;
  scope?: "global" | "tenant";
  capability?: AsistenteCapability;
}

/**
 * Comprueba si la capacidad solicitada está permitida.
 *
 * Orden:
 *  1) Global switch: si enabled=false → bloquea.
 *  2) Global feature_flags[capability] = false → bloquea.
 *  3) Tenant switch: si enabled=false → bloquea.
 *  4) Tenant feature_flags[capability] = false → bloquea.
 *
 * Fail-safe: si algo truena, bloqueamos con reason='kill_switch_error'.
 */
export async function checkKillSwitch(opts: {
  tenantId: string;
  capability: AsistenteCapability;
}): Promise<KillSwitchResult> {
  try {
    const global = await getSwitch("global");
    if (!global.enabled) {
      return {
        allowed: false,
        reason: global.reason ?? "global_kill_switch_active",
        scope: "global",
        capability: opts.capability,
      };
    }
    if (global.flags[opts.capability] === false) {
      return {
        allowed: false,
        reason: `global_feature_disabled:${opts.capability}`,
        scope: "global",
        capability: opts.capability,
      };
    }

    const tenant = await getSwitch("tenant", opts.tenantId);
    if (!tenant.enabled) {
      return {
        allowed: false,
        reason: tenant.reason ?? "tenant_kill_switch_active",
        scope: "tenant",
        capability: opts.capability,
      };
    }
    if (tenant.flags[opts.capability] === false) {
      return {
        allowed: false,
        reason: `tenant_feature_disabled:${opts.capability}`,
        scope: "tenant",
        capability: opts.capability,
      };
    }

    return { allowed: true };
  } catch {
    return {
      allowed: false,
      reason: "kill_switch_error",
    };
  }
}

/**
 * Invalida el cache (útil tras UPDATE del switch desde la UI).
 */
export function invalidateKillSwitchCache(scope: "global" | "tenant", tenantId?: string) {
  cache.delete(cacheKey(scope, tenantId));
}
