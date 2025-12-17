"use client";

import { useState, useEffect, useCallback } from "react";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  isStale: boolean;
};

const cache = new Map<string, CacheEntry<any>>();
const STALE_TIME = 5 * 60 * 1000; // 5 minutos (antes 30 segundos)
const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 horas (antes 5 minutos)
const STORAGE_PREFIX = "swr-cache:";

function loadFromStorage<T>(key: string, cacheTime: number): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T> & { expiresAt?: number };
    const age = Date.now() - parsed.timestamp;

    if (Number.isFinite(cacheTime) && age > cacheTime) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[useSWR] Error reading persisted cache", err);
    return null;
  }
}

function persistToStorage<T>(key: string, entry: CacheEntry<T> | null) {
  if (typeof window === "undefined") return;
  try {
    if (!entry) {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return;
    }
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (err) {
    console.warn("[useSWR] Error persisting cache", err);
  }
}

/**
 * Hook para caché con estrategia Stale-While-Revalidate
 * Muestra datos cacheados instantáneamente mientras revalida en segundo plano
 */
export function useStaleWhileRevalidate<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    persist?: boolean;
    initialData?: T | null;
  } = {},
) {
  const {
    staleTime = STALE_TIME,
    cacheTime = CACHE_TIME,
    enabled = true,
    persist = false,
    initialData,
  } = options;

  const [data, setData] = useState<T | null>(() => {
    if (initialData !== undefined && initialData !== null) {
      return initialData;
    }

    // Si key es null, no podemos buscar en caché
    if (!key) return null;

    // Intentar obtener datos del caché al montar
    const cached = cache.get(key);
    const cachedAge = cached ? Date.now() - cached.timestamp : null;
    if (cached && cachedAge !== null && cachedAge < cacheTime) {
      return cached.data;
    }

    if (persist) {
      const persisted = loadFromStorage<T>(key, cacheTime);
      if (persisted) {
        cache.set(key, persisted);
        return persisted.data;
      }
    }

    return null;
  });

  const [isLoading, setIsLoading] = useState(!data && !!key); // Solo loading si hay key y no hay data
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !key) return; // Skip if no key

    if (initialData !== undefined && initialData !== null) {
      const entry = { data: initialData, timestamp: Date.now(), isStale: false } as CacheEntry<T>;
      cache.set(key, entry);
      if (persist) persistToStorage(key, entry);
      setIsLoading(false);
    }
  }, [key, initialData, enabled, persist]);

  const revalidate = useCallback(async () => {
    if (!enabled || !key) return;

    try {
      setIsValidating(true);
      const freshData = await fetcher();

      // Actualizar caché
      const entry = {
        data: freshData,
        timestamp: Date.now(),
        isStale: false,
      } satisfies CacheEntry<T>;

      cache.set(key, entry);
      if (persist) persistToStorage(key, entry);

      setData(freshData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  }, [key, fetcher, enabled, persist]);

  useEffect(() => {
    if (!enabled || !key) {
      // If key becomes null, we might want to reset data or isLoading?
      // Usually we keep old data or reset. For now, we do nothing.
      return;
    }

    const cached = cache.get(key);
    const now = Date.now();

    if (cached) {
      const age = now - cached.timestamp;

      // Si los datos están frescos, usarlos sin revalidar
      if (age < staleTime) {
        setData(cached.data);
        setIsLoading(false);
        return;
      }

      // Si están stale pero aún en caché, mostrarlos y revalidar
      if (age < cacheTime) {
        setData(cached.data);
        setIsLoading(false);
        revalidate();
        return;
      }
    }

    if (persist) {
      const persisted = loadFromStorage<T>(key, cacheTime);
      if (persisted) {
        cache.set(key, persisted);
        setData(persisted.data);
        setIsLoading(false);
        if (now - persisted.timestamp >= staleTime) {
          revalidate();
        }
        return;
      }
    }

    // No hay caché válido, revalidar
    revalidate();
  }, [key, staleTime, cacheTime, enabled, revalidate, persist]);

  return {
    data,
    isLoading,
    isValidating,
    error,
    revalidate,
  };
}

/**
 * Limpiar caché manualmente (útil después de mutaciones)
 */
export function invalidateCache(key: string | string[]) {
  if (Array.isArray(key)) {
    key.forEach((k) => cache.delete(k));
  } else {
    cache.delete(key);
  }

  if (typeof window !== "undefined") {
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach((k) => localStorage.removeItem(`${STORAGE_PREFIX}${k}`));
  }
}

/**
 * Precargar datos en caché
 */
export async function prefetchData<T>(key: string, fetcher: () => Promise<T>) {
  try {
    const data = await fetcher();
    const entry = {
      data,
      timestamp: Date.now(),
      isStale: false,
    } satisfies CacheEntry<T>;
    cache.set(key, entry);
    if (typeof window !== "undefined") {
      persistToStorage(key, entry);
    }
  } catch (error) {
    console.error(`Error prefetching ${key}:`, error);
  }
}

/**
 * Hook para caché con estrategia Stale-While-Revalidate + Real-time updates
 * Actualiza automáticamente cuando llegan cambios via Supabase realtime
 */
export function useRealtimeStaleWhileRevalidate<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  realtimeConfig: {
    table: string;
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    tenantId: string;
    supabase: any;
  },
  options: {
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    persist?: boolean;
    initialData?: T | null;
    realtimeEnabled?: boolean;
  } = {},
) {
  const {
    staleTime = STALE_TIME,
    cacheTime = CACHE_TIME,
    enabled = true,
    persist = false,
    initialData,
    realtimeEnabled = true,
  } = options;

  const { table, filter, event = '*', tenantId, supabase } = realtimeConfig;

  const [data, setData] = useState<T | null>(() => {
    if (initialData !== undefined && initialData !== null) {
      return initialData;
    }

    if (!key) return null;

    // Intentar obtener datos del caché al montar
    const cached = cache.get(key);
    const cachedAge = cached ? Date.now() - cached.timestamp : null;
    if (cached && cachedAge !== null && cachedAge < cacheTime) {
      return cached.data;
    }

    if (persist) {
      const persisted = loadFromStorage<T>(key, cacheTime);
      if (persisted) {
        cache.set(key, persisted);
        return persisted.data;
      }
    }

    return null;
  });

  const [isLoading, setIsLoading] = useState(!data && !!key);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Función de revalidación
  const revalidate = useCallback(async () => {
    if (!enabled || !key) return;

    try {
      setIsValidating(true);
      const freshData = await fetcher();

      // Actualizar caché
      const entry = {
        data: freshData,
        timestamp: Date.now(),
        isStale: false,
      } satisfies CacheEntry<T>;

      cache.set(key, entry);
      if (persist) persistToStorage(key, entry);

      setData(freshData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  }, [key, fetcher, enabled, persist]);

  // Setup inicial
  useEffect(() => {
    if (!enabled || !key) return;

    if (initialData !== undefined && initialData !== null) {
      const entry = { data: initialData, timestamp: Date.now(), isStale: false } as CacheEntry<T>;
      cache.set(key, entry);
      if (persist) persistToStorage(key, entry);
      setIsLoading(false);
    }
  }, [key, initialData, enabled, persist]);

  // Lógica de SWR normal
  useEffect(() => {
    if (!enabled || !key) return;

    const cached = cache.get(key);
    const now = Date.now();

    if (cached) {
      const age = now - cached.timestamp;

      // Si los datos están frescos, usarlos sin revalidar
      if (age < staleTime) {
        setData(cached.data);
        setIsLoading(false);
        return;
      }

      // Si están stale pero aún en caché, mostrarlos y revalidar
      if (age < cacheTime) {
        setData(cached.data);
        setIsLoading(false);
        revalidate();
        return;
      }
    }

    if (persist) {
      const persisted = loadFromStorage<T>(key, cacheTime);
      if (persisted) {
        cache.set(key, persisted);
        setData(persisted.data);
        setIsLoading(false);
        if (now - persisted.timestamp >= staleTime) {
          revalidate();
        }
        return;
      }
    }

    // No hay caché válido, revalidar
    revalidate();
  }, [key, staleTime, cacheTime, enabled, revalidate, persist]);

  // Real-time subscription
  useEffect(() => {
    if (!enabled || !realtimeEnabled || !supabase || !tenantId || !key) return;

    const channelName = `realtime-${key}-${tenantId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: event,
          schema: 'public',
          table: table,
          ...(filter && { filter: filter }),
        },
        () => {
          // Cuando llegan cambios, marcar como stale para revalidar en el próximo render
          const cached = cache.get(key);
          if (cached) {
            cached.isStale = true;
          }
          // Forzar re-render para que el SWR normal detecte que está stale
          setData(current => current);
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Suscrito a ${table} para ${key}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      console.log(`[Realtime] Desuscrito de ${table} para ${key}`);
    };
  }, [enabled, realtimeEnabled, supabase, tenantId, table, filter, event, key]);

  return {
    data,
    isLoading,
    isValidating,
    error,
    revalidate,
  };
}
