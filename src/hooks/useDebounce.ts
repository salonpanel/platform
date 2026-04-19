import { useEffect, useState } from "react";

/**
 * useDebounce — retrasa la actualización de un valor hasta que haya pasado
 * el tiempo indicado sin cambios. Útil para evitar cálculos costosos
 * (filtros, búsquedas) en cada keystroke.
 *
 * @param value  Valor a debouncear
 * @param delay  Milisegundos de espera (default 200ms)
 */
export function useDebounce<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
