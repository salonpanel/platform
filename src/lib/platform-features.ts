import { supabaseServer } from "./supabase";

type FeatureStatus = {
  feature_key: string;
  enabled: boolean;
  quota_limit: Record<string, any>;
};

// Cache simple en memoria (5 minutos)
const cache = new Map<string, { data: FeatureStatus[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene todas las features activas de una organización
 * Resolución: overrides > plan_features > default
 */
export async function getOrgFeatures(
  orgId: string
): Promise<FeatureStatus[]> {
  const cacheKey = `features:${orgId}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("get_org_features", {
    p_org_id: orgId,
  });

  if (error) {
    console.error("Error fetching org features:", error);
    return [];
  }

  const features = (data as FeatureStatus[]) || [];
  cache.set(cacheKey, {
    data: features,
    expires: Date.now() + CACHE_TTL,
  });

  return features;
}

/**
 * Verifica si una organización tiene un feature activo
 */
export async function hasFeature(
  orgId: string,
  featureKey: string
): Promise<boolean> {
  const features = await getOrgFeatures(orgId);
  return features.some(
    (f) => f.feature_key === featureKey && f.enabled === true
  );
}

/**
 * Obtiene el límite de quota para un feature
 */
export async function getFeatureQuota(
  orgId: string,
  featureKey: string
): Promise<Record<string, any> | null> {
  const features = await getOrgFeatures(orgId);
  const feature = features.find((f) => f.feature_key === featureKey);
  return feature?.quota_limit || null;
}

/**
 * Limpia el cache (útil para tests o después de cambios)
 */
export function clearFeatureCache(orgId?: string) {
  if (orgId) {
    cache.delete(`features:${orgId}`);
  } else {
    cache.clear();
  }
}







