"use client";

import { useState, useEffect } from "react";

export type InputMode = "mouse" | "touch" | "unknown";

interface UseInputModeReturn {
  inputMode: InputMode;
  isTouch: boolean;
  isMouse: boolean;
}

/**
 * Hook para detectar el modo de entrada predominante (touch vs mouse)
 * Permite condicionar comportamientos como hover, tamaños de botones, etc.
 */
export function useInputMode(): UseInputModeReturn {
  const [inputMode, setInputMode] = useState<InputMode>(() => {
    if (typeof window === "undefined") return "unknown";
    // Detectar si el dispositivo tiene capacidad táctil
    return "ontouchstart" in window || navigator.maxTouchPoints > 0 ? "touch" : "mouse";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastInputType: InputMode = inputMode;
    let touchTimer: NodeJS.Timeout | null = null;

    const handleTouchStart = () => {
      lastInputType = "touch";
      setInputMode("touch");
      
      // Limpiar timer si existe
      if (touchTimer) {
        clearTimeout(touchTimer);
      }
    };

    const handleMouseMove = () => {
      // Solo cambiar a mouse si no ha habido touch recientemente
      if (lastInputType !== "touch") {
        setInputMode("mouse");
      }
    };

    // Detectar interacción inicial
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("mousemove", handleMouseMove);
      if (touchTimer) {
        clearTimeout(touchTimer);
      }
    };
  }, []);

  return {
    inputMode,
    isTouch: inputMode === "touch",
    isMouse: inputMode === "mouse",
  };
}




