"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, Calendar, Users, Search, Settings, CheckCircle } from "lucide-react";

type LoadingType =
  | "page"
  | "bookings"
  | "staff"
  | "search"
  | "filters"
  | "saving"
  | "syncing"
  | "optimizing"
  | "calendar"
  | "modal";

interface PremiumLoaderProps {
  type: LoadingType;
  message?: string;
  size?: "sm" | "md" | "lg";
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
  showIcon?: boolean;
  variant?: "spinner" | "pulse" | "skeleton" | "progress";
}

/**
 * PremiumLoader - Estados de carga contextuales premium
 * Loaders inteligentes que se adaptan al contexto y operación
 */
export function PremiumLoader({
  type,
  message,
  size = "md",
  density = "default",
  className,
  showIcon = true,
  variant = "spinner"
}: PremiumLoaderProps) {

  // Configuración por tipo
  const getConfig = (type: LoadingType) => {
    switch (type) {
      case "page":
        return {
          icon: Calendar,
          defaultMessage: "Cargando agenda premium...",
          color: "text-[var(--accent-aqua)]",
          bg: "bg-[var(--accent-aqua)]/10",
        };
      case "bookings":
        return {
          icon: Calendar,
          defaultMessage: "Cargando reservas...",
          color: "text-[var(--accent-blue)]",
          bg: "bg-[var(--accent-blue)]/10",
        };
      case "staff":
        return {
          icon: Users,
          defaultMessage: "Cargando equipo...",
          color: "text-[var(--accent-purple)]",
          bg: "bg-[var(--accent-purple)]/10",
        };
      case "search":
        return {
          icon: Search,
          defaultMessage: "Buscando...",
          color: "text-[var(--accent-aqua)]",
          bg: "bg-[var(--accent-aqua)]/10",
        };
      case "filters":
        return {
          icon: Settings,
          defaultMessage: "Aplicando filtros...",
          color: "text-[var(--accent-blue)]",
          bg: "bg-[var(--accent-blue)]/10",
        };
      case "saving":
        return {
          icon: CheckCircle,
          defaultMessage: "Guardando cambios...",
          color: "text-[var(--accent-aqua)]",
          bg: "bg-[var(--accent-aqua)]/10",
        };
      case "syncing":
        return {
          icon: Loader2,
          defaultMessage: "Sincronizando...",
          color: "text-[var(--accent-purple)]",
          bg: "bg-[var(--accent-purple)]/10",
        };
      case "optimizing":
        return {
          icon: Settings,
          defaultMessage: "Optimizando agenda...",
          color: "text-[var(--accent-blue)]",
          bg: "bg-[var(--accent-blue)]/10",
        };
      case "calendar":
        return {
          icon: Calendar,
          defaultMessage: "Cargando calendario...",
          color: "text-[var(--accent-aqua)]",
          bg: "bg-[var(--accent-aqua)]/10",
        };
      case "modal":
        return {
          icon: Loader2,
          defaultMessage: "Cargando...",
          color: "text-[var(--accent-blue)]",
          bg: "bg-[var(--accent-blue)]/10",
        };
      default:
        return {
          icon: Loader2,
          defaultMessage: "Cargando...",
          color: "text-[var(--accent-aqua)]",
          bg: "bg-[var(--accent-aqua)]/10",
        };
    }
  };

  const config = getConfig(type);
  const displayMessage = message || config.defaultMessage;

  // Tamaños
  const sizeClasses = {
    sm: density === "ultra-compact" ? "h-3 w-3" : density === "compact" ? "h-4 w-4" : "h-5 w-5",
    md: density === "ultra-compact" ? "h-4 w-4" : density === "compact" ? "h-5 w-5" : "h-6 w-6",
    lg: density === "ultra-compact" ? "h-5 w-5" : density === "compact" ? "h-6 w-6" : "h-8 w-8",
  };

  // Variantes de animación
  const getVariant = () => {
    switch (variant) {
      case "pulse":
        return (
          <motion.div
            className={cn("rounded-full", config.bg)}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              width: size === "sm" ? "8px" : size === "md" ? "12px" : "16px",
              height: size === "sm" ? "8px" : size === "md" ? "12px" : "16px",
            }}
          />
        );

      case "skeleton":
        return (
          <div className="space-y-2">
            <div className="h-4 bg-[var(--glass-bg)] rounded animate-pulse" />
            <div className="h-4 bg-[var(--glass-bg)] rounded animate-pulse w-3/4" />
            <div className="h-4 bg-[var(--glass-bg)] rounded animate-pulse w-1/2" />
          </div>
        );

      case "progress":
        return (
          <div className="w-full bg-[var(--glass-bg)] rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>
        );

      default: // spinner
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            <config.icon className={cn(sizeClasses[size], config.color)} />
          </motion.div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "flex items-center gap-3 p-4 rounded-[var(--radius-lg)]",
        config.bg,
        "border border-[var(--glass-border)] backdrop-blur-sm",
        className
      )}
    >
      {showIcon && getVariant()}

      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium",
          config.color,
          density === "ultra-compact" ? "text-xs" : density === "compact" ? "text-sm" : "text-base",
          "font-[var(--font-body)]"
        )}>
          {displayMessage}
        </p>

        {/* Indicador adicional para operaciones largas */}
        {(type === "saving" || type === "syncing" || type === "optimizing") && variant === "progress" && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
              <span>Progreso</span>
              <span>...</span>
            </div>
            {getVariant()}
          </div>
        )}
      </div>

      {/* Efecto de brillo sutil */}
      <div className="absolute inset-0 rounded-[var(--radius-lg)] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </motion.div>
  );
}
