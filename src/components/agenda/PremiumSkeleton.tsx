"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SkeletonType =
  | "booking-card"
  | "agenda-grid"
  | "staff-list"
  | "stats-cards"
  | "timeline"
  | "calendar-day"
  | "filters-bar";

interface PremiumSkeletonProps {
  type: SkeletonType;
  count?: number;
  density?: "default" | "compact" | "ultra-compact";
  className?: string;
}

/**
 * PremiumSkeleton - Skeletons contextuales premium
 * Placeholders inteligentes que simulan la estructura real
 */
export function PremiumSkeleton({
  type,
  count = 1,
  density = "default",
  className
}: PremiumSkeletonProps) {

  const baseClasses = "bg-[var(--glass-bg)] rounded-[var(--radius-md)] animate-pulse";
  const spacing = density === "ultra-compact" ? "space-y-1" : density === "compact" ? "space-y-2" : "space-y-3";

  const renderSkeleton = (type: SkeletonType, index: number = 0) => {
    switch (type) {
      case "booking-card":
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "p-3 border border-[var(--glass-border)] backdrop-blur-sm",
              density === "ultra-compact" ? "p-2" : density === "compact" ? "p-2.5" : "p-3"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Avatar skeleton */}
              <div className={cn(
                baseClasses,
                density === "ultra-compact" ? "h-5 w-5" : density === "compact" ? "h-6 w-6" : "h-7 w-7"
              )} />

              <div className="flex-1 space-y-2">
                {/* Nombre y servicio */}
                <div className="space-y-1">
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-3 w-20" : density === "compact" ? "h-4 w-24" : "h-4 w-28"
                  )} />
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-3 w-16" : density === "compact" ? "h-3 w-20" : "h-3 w-24"
                  )} />
                </div>

                {/* Hora y precio */}
                <div className="flex items-center justify-between">
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-3 w-12" : density === "compact" ? "h-3 w-14" : "h-3 w-16"
                  )} />
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-3 w-10" : density === "compact" ? "h-4 w-12" : "h-4 w-14"
                  )} />
                </div>
              </div>

              {/* Badge skeleton */}
              <div className={cn(
                baseClasses,
                density === "ultra-compact" ? "h-5 w-12" : density === "compact" ? "h-6 w-14" : "h-6 w-16"
              )} />
            </div>
          </motion.div>
        );

      case "agenda-grid":
        return (
          <div className="grid grid-cols-8 gap-4">
            {/* Time column */}
            <div className="space-y-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={cn(baseClasses, "h-8 w-full")} />
              ))}
            </div>

            {/* Day columns */}
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div key={dayIndex} className="relative space-y-2">
                {Array.from({ length: 12 }).map((_, hourIndex) => (
                  <div key={hourIndex} className={cn(baseClasses, "h-8 w-full")} />
                ))}

                {/* Random booking placeholders */}
                {Math.random() > 0.7 && (
                  <div
                    className={cn(
                      "absolute left-1 right-1 rounded-lg border border-[var(--glass-border)] p-2",
                      "bg-[var(--glass-bg-subtle)]"
                    )}
                    style={{
                      top: `${Math.random() * 80 + 10}%`,
                      height: `${Math.random() * 20 + 10}%`
                    }}
                  >
                    <div className={cn(baseClasses, "h-3 w-3/4 mb-1")} />
                    <div className={cn(baseClasses, "h-2 w-1/2")} />
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case "staff-list":
        return (
          <div className={cn("flex gap-2 overflow-hidden", spacing)}>
            {Array.from({ length: count }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border border-[var(--glass-border)]",
                  density === "ultra-compact" ? "p-1.5" : density === "compact" ? "p-2" : "p-2.5"
                )}
              >
                <div className={cn(
                  baseClasses,
                  density === "ultra-compact" ? "h-4 w-4" : density === "compact" ? "h-5 w-5" : "h-6 w-6"
                )} />
                <div className="space-y-1">
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-2 w-8" : density === "compact" ? "h-3 w-10" : "h-3 w-12"
                  )} />
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-2 w-6" : density === "compact" ? "h-2 w-8" : "h-2 w-10"
                  )} />
                </div>
              </motion.div>
            ))}
          </div>
        );

      case "stats-cards":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 rounded-lg border border-[var(--glass-border)] backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    baseClasses,
                    density === "ultra-compact" ? "h-6 w-6" : density === "compact" ? "h-7 w-7" : "h-8 w-8"
                  )} />
                  <div className="space-y-2">
                    <div className={cn(
                      baseClasses,
                      density === "ultra-compact" ? "h-4 w-8" : density === "compact" ? "h-5 w-10" : "h-6 w-12"
                    )} />
                    <div className={cn(
                      baseClasses,
                      density === "ultra-compact" ? "h-3 w-6" : density === "compact" ? "h-3 w-8" : "h-3 w-10"
                    )} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        );

      case "timeline":
        return (
          <div className="relative">
            {/* Current time line skeleton */}
            <div className="absolute left-0 right-0 h-0.5 bg-[var(--glass-border)] top-1/2 transform -translate-y-1/2" />

            <div className="flex">
              {/* Time column */}
              <div className="w-16 space-y-4 py-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn(baseClasses, "h-4 w-full")} />
                ))}
              </div>

              {/* Timeline area */}
              <div className="flex-1 relative py-4">
                <div className="absolute inset-0 border-l border-[var(--glass-border)] ml-4" />

                {/* Random booking placeholders */}
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-6 right-4 p-2 rounded border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]"
                    style={{
                      top: `${20 + i * 25}%`,
                      height: `${Math.random() * 15 + 5}%`
                    }}
                  >
                    <div className={cn(baseClasses, "h-3 w-3/4 mb-1")} />
                    <div className={cn(baseClasses, "h-2 w-1/2")} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "calendar-day":
        return (
          <div className="p-4 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)]">
            <div className={cn(baseClasses, "h-6 w-8 mb-2 mx-auto")} />
            <div className="space-y-1">
              {Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map((_, i) => (
                <div key={i} className={cn(baseClasses, "h-3 w-full rounded")} />
              ))}
            </div>
          </div>
        );

      case "filters-bar":
        return (
          <div className="flex items-center gap-4 p-4 rounded-lg border border-[var(--glass-border)]">
            <div className={cn(baseClasses, "h-8 w-8")} />
            <div className="flex-1">
              <div className={cn(baseClasses, "h-4 w-48")} />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn(baseClasses, "h-6 w-16")} />
              ))}
            </div>
          </div>
        );

      default:
        return <div className={cn(baseClasses, "h-4 w-32")} />;
    }
  };

  return (
    <div className={cn(spacing, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`premium-skeleton-${type}-${i}`}>
          {renderSkeleton(type, i)}
        </div>
      ))}
    </div>
  );
}
