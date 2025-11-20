"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useDensity, Density } from "@/hooks/useDensity";
import { cn } from "@/lib/utils";

export type DeviceType = "mobile" | "tablet" | "desktop";

interface HeightContextType {
  height: number;
  width: number;
  availableHeight: number;
  density: Density;
  deviceType: DeviceType;
  isLarge: boolean;
  isMedium: boolean;
  isSmall: boolean;
  isCompact: boolean;
  isUltraCompact: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const HeightContext = createContext<HeightContextType | undefined>(undefined);

export function useHeightAware() {
  const context = useContext(HeightContext);
  if (!context) {
    // Fallback para cuando no hay provider
    const fallbackWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
    const fallbackHeight = typeof window !== "undefined" ? window.innerHeight : 800;
    const fallbackDeviceType: DeviceType = 
      fallbackWidth < 768 ? "mobile" : fallbackWidth < 1024 ? "tablet" : "desktop";
    
    return {
      height: fallbackHeight,
      width: fallbackWidth,
      availableHeight: fallbackHeight,
      density: "normal" as Density,
      deviceType: fallbackDeviceType,
      isLarge: true,
      isMedium: false,
      isSmall: false,
      isCompact: false,
      isUltraCompact: false,
      isMobile: fallbackDeviceType === "mobile",
      isTablet: fallbackDeviceType === "tablet",
      isDesktop: fallbackDeviceType === "desktop",
    };
  }
  return context;
}

interface HeightAwareContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Contenedor que mide altura disponible y expone contexto de densidad y tipo de dispositivo
 * Bloquea scroll vertical y permite scroll interno inteligente solo donde sea necesario
 */
export function HeightAwareContainer({ children, className }: HeightAwareContainerProps) {
  const { density, height, width, isCompact, isUltraCompact } = useDensity();
  const [availableHeight, setAvailableHeight] = useState(height);

  // Determinar tipo de dispositivo basado en ancho
  const deviceType: DeviceType = width < 768 ? "mobile" : width < 1024 ? "tablet" : "desktop";

  // Calcular altura disponible (considerando headers, footers, etc.)
  useEffect(() => {
    const updateAvailableHeight = () => {
      // En móvil, restar altura de BottomNavBar si existe (aprox 64px)
      // En desktop/tablet, considerar TopBar (aprox 80px)
      const offset = deviceType === "mobile" ? 64 : 80;
      setAvailableHeight(Math.max(0, height - offset));
    };

    updateAvailableHeight();
    window.addEventListener("resize", updateAvailableHeight);
    return () => window.removeEventListener("resize", updateAvailableHeight);
  }, [height, deviceType]);

  const isLarge = height > 950;
  const isMedium = height > 800 && height <= 950;
  const isSmall = height <= 800;

  const value: HeightContextType = {
    height,
    width,
    availableHeight,
    density,
    deviceType,
    isLarge,
    isMedium,
    isSmall,
    isCompact,
    isUltraCompact,
    isMobile: deviceType === "mobile",
    isTablet: deviceType === "tablet",
    isDesktop: deviceType === "desktop",
  };

  return (
    <HeightContext.Provider value={value}>
      <div className={cn("h-full min-h-0 overflow-hidden", className)}>
        {children}
      </div>
    </HeightContext.Provider>
  );
}

