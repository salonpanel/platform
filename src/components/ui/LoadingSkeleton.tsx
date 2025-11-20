"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface LoadingSkeletonProps {
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
  animated?: boolean;
}

export function LoadingSkeleton({
  variant = "text",
  width,
  height,
  className,
  count = 1,
  animated = true,
}: LoadingSkeletonProps) {
  const baseStyles = "glass rounded-[var(--radius-md)]";

  const variantStyles = {
    text: "h-4",
    circular: "rounded-[var(--radius-pill)]",
    rectangular: "",
    card: "h-32",
  };

  const skeletonContent = (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        !width && variant === "text" && "w-full",
        !width && variant === "rectangular" && "w-full",
        !width && variant === "card" && "w-full",
        !height && variant === "circular" && "aspect-square",
        className
      )}
      style={{
        width: width,
        height: height,
        background: `linear-gradient(
          90deg,
          var(--glass-bg) 0%,
          var(--glass-bg-strong) 50%,
          var(--glass-bg) 100%
        )`,
        backgroundSize: "200% 100%",
        animation: animated ? "shimmer 1.5s ease-in-out infinite" : "none",
      }}
    />
  );

  if (count === 1) {
    return skeletonContent;
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1, duration: 0.2 }}
        >
          {skeletonContent}
        </motion.div>
      ))}
    </div>
  );
}

// Add shimmer animation to globals.css if not exists
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
  `;
  if (!document.head.querySelector('style[data-skeleton-animation]')) {
    style.setAttribute("data-skeleton-animation", "true");
    document.head.appendChild(style);
  }
}

/**
 * ============================================================================
 * LOADINGSKELETON COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Loading states en listas
 * - Loading states en cards
 * - Cualquier lugar donde se muestre contenido cargando
 * 
 * PROPS PRINCIPALES:
 * - variant: "text" | "circular" | "rectangular" | "card" - Tipo de skeleton
 * - width: string | number - Ancho del skeleton
 * - height: string | number - Alto del skeleton
 * - count: number - Número de skeletons a mostrar
 * - animated: boolean - Mostrar animación shimmer
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * // Text skeleton
 * {loading && <LoadingSkeleton variant="text" count={3} />}
 * 
 * // Card skeleton
 * {loading && (
 *   <div className="grid grid-cols-3 gap-4">
 *     {Array.from({ length: 6 }).map((_, i) => (
 *       <LoadingSkeleton key={i} variant="card" />
 *     ))}
 *   </div>
 * )}
 * 
 * // Circular avatar skeleton
 * <LoadingSkeleton variant="circular" width={40} height={40} />
 * ```
 */


