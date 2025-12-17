"use client";

import { useEffect, useRef } from "react";

interface ScrollSyncManagerProps {
  columns: HTMLElement[];
  enabled?: boolean;
}

export function useScrollSyncManager({ columns, enabled = true }: ScrollSyncManagerProps) {
  const isScrollingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || columns.length === 0) return;

    const syncScroll = (source: HTMLElement, targetScrollTop: number) => {
      if (isScrollingRef.current) return;

      isScrollingRef.current = true;

      requestAnimationFrame(() => {
        columns.forEach((col) => {
          if (col && col !== source) {
            const currentScroll = col.scrollTop;
            if (Math.abs(currentScroll - targetScrollTop) > 0.5) {
              col.scrollTop = targetScrollTop;
            }
          }
        });

        requestAnimationFrame(() => {
          isScrollingRef.current = false;
        });
      });
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!isScrollingRef.current) {
        const scrollTop = target.scrollTop;
        syncScroll(target, scrollTop);
      }
    };

    // Add listeners with passive option for better performance
    columns.forEach((col) => {
      if (col) {
        col.addEventListener('scroll', handleScroll, { passive: true });
      }
    });

    // Cleanup function
    const cleanup = () => {
      columns.forEach((col) => {
        if (col) {
          col.removeEventListener('scroll', handleScroll);
        }
      });
    };

    cleanupRef.current = cleanup;

    return cleanup;
  }, [columns, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return {
    isScrolling: isScrollingRef.current,
  };
}
