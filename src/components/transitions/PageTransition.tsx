"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BF_PAGE_TRANSITION } from "@/lib/motion";

/**
 * El template de Next se remonta en cada ruta; un ref interno no sirve para
 * “solo la primera carga de la app”. Este flag persiste entre instancias.
 */
let suppressEnterUntilAfterFirstHydration = true;

/**
 * Transición entre rutas: avance sutil hacia un lado, “atrás” del navegador al revés.
 * Respeta prefers-reduced-motion (solo fundido corto).
 * La primera pintura tras cargar la app no anima la entrada.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const popPendingRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    suppressEnterUntilAfterFirstHydration = false;
  }, []);

  useEffect(() => {
    const onPopState = () => {
      popPendingRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  let navDirection = 1;
  if (prevPathnameRef.current !== pathname) {
    navDirection = popPendingRef.current ? -1 : 1;
    popPendingRef.current = false;
    prevPathnameRef.current = pathname;
  }

  const xOffset = reduceMotion ? 0 : navDirection === -1 ? -14 : 14;
  const firstAppPaint = suppressEnterUntilAfterFirstHydration;

  return (
    <motion.div
      key={pathname}
      initial={
        firstAppPaint
          ? false
          : reduceMotion
            ? { opacity: 0 }
            : { opacity: 0, x: xOffset }
      }
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.12, ease: "easeOut" }
          : BF_PAGE_TRANSITION
      }
      className="min-h-0 min-w-0"
    >
      {children}
    </motion.div>
  );
}
