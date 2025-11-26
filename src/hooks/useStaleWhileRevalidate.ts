"use client";

import { useState, useEffect, useCallback } from "react";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  isStale: boolean;
};

const cache = new Map<string, CacheEntry<any>>();
const STALE_TIME = 30000; // 30 segundos
const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

/**
 * Hook para caché con estrategia Stale-While-Revalidate
 * Muestra datos cacheados instantáneamente mientras revalida en segundo plano
 */
export function useStaleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    staleTime = STALE_TIME,
    cacheTime = CACHE_TIME,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(() => {
    // Intentar obtener datos del caché al montar
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < cacheTime) {
      return cached.data;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(!data);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const revalidate = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsValidating(true);
      const freshData = await fetcher();
      
      // Actualizar caché
      cache.set(key, {
        data: freshData,
        timestamp: Date.now(),
        isStale: false,
      });

      setData(freshData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsValidating(false);
      setIsLoading(false);
    }
  }, [key, fetcher, enabled]);

  useEffect(() => {
    if (!enabled) return;

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

    // No hay caché válido, revalidar
    revalidate();
  }, [key, staleTime, cacheTime, enabled, revalidate]);

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
}

/**
 * Precargar datos en caché
 */
export async function prefetchData<T>(key: string, fetcher: () => Promise<T>) {
  try {
    const data = await fetcher();
    cache.set(key, {
      data,
      timestamp: Date.now(),
      isStale: false,
    });
  } catch (error) {
    console.error(`Error prefetching ${key}:`, error);
  }
}
