"use client";

import { useRef, useCallback } from "react";

interface UseTouchSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // px mínimo para activar swipe
  disabled?: boolean;
}

/**
 * Hook para detectar swipe horizontal táctil.
 * Retorna handlers para aplicar al elemento contenedor.
 */
export function useTouchSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  disabled = false,
}: UseTouchSwipeOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, [disabled]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

    // Ignore if predominantly vertical (scrolling)
    if (deltaY > Math.abs(deltaX) * 0.7) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    if (Math.abs(deltaX) >= threshold) {
      if (deltaX < 0) {
        onSwipeLeft?.(); // swipe left → next day
      } else {
        onSwipeRight?.(); // swipe right → previous day
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [disabled, threshold, onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
}
