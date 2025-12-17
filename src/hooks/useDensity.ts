"use client";

import { useState, useEffect } from "react";

export type Density = "normal" | "compact" | "ultra-compact";

interface UseDensityReturn {
  density: Density;
  isCompact: boolean;
  isUltraCompact: boolean;
  height: number;
  width: number;
}

/**
 * Hook para detectar densidad basada en altura del viewport
 * Breakpoints: 950px (normal), 800px (compact), 700px (ultra-compact)
 */
export function useDensity(): UseDensityReturn {
  const [dimensions, setDimensions] = useState({
    height: typeof window !== "undefined" ? window.innerHeight : 800,
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
  });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        height: window.innerHeight,
        width: window.innerWidth,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const { height, width } = dimensions;

  // Determinar densidad basada en breakpoints
  // > 950px → normal
  // 750-950px → compact
  // <= 750px → ultra-compact
  let density: Density = "normal";
  if (height <= 750) {
    density = "ultra-compact";
  } else if (height <= 950) {
    density = "compact";
  }

  return {
    density,
    isCompact: density === "compact" || density === "ultra-compact",
    isUltraCompact: density === "ultra-compact",
    height,
    width,
  };
}

