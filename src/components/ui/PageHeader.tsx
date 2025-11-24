"use client";

import { ReactNode, memo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "elevated" | "glass" | "minimal";
  isLoading?: boolean;
}

/**
 * Unified PageHeader component following the premium design system
 * Features responsive design, glass effects, and consistent typography
 */
const PageHeaderComponent = ({
  title,
  subtitle,
  description,
  actions,
  breadcrumbs,
  className,
  size = "md",
  variant = "default",
  isLoading = false
}: PageHeaderProps) => {
  const sizeConfig = {
    sm: {
      titleSize: "text-lg sm:text-xl",
      subtitleSize: "text-sm",
      descriptionSize: "text-xs sm:text-sm",
      padding: "py-3 sm:py-4",
      spacing: "space-y-2 sm:space-y-3"
    },
    md: {
      titleSize: "text-xl sm:text-2xl",
      subtitleSize: "text-sm sm:text-base",
      descriptionSize: "text-xs sm:text-sm",
      padding: "py-4 sm:py-5",
      spacing: "space-y-3 sm:space-y-4"
    },
    lg: {
      titleSize: "text-2xl sm:text-3xl",
      subtitleSize: "text-base sm:text-lg",
      descriptionSize: "text-sm sm:text-base",
      padding: "py-5 sm:py-6",
      spacing: "space-y-4 sm:space-y-5"
    }
  };

  const config = sizeConfig[size];

  const variantClasses = {
    default: "",
    elevated: "glass-elevated shadow-neon-glow-blue/10",
    glass: "glass-subtle",
    minimal: "bg-transparent border-none shadow-none"
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className={cn(
          "relative rounded-2xl",
          variantClasses[variant],
          config.padding,
          config.spacing,
          className
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Breadcrumb skeleton */}
              {breadcrumbs && (
                <div className="flex items-center gap-2 text-xs mb-2">
                  {breadcrumbs.map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {index > 0 && <span className="text-[var(--color-text-disabled)]">/</span>}
                      <div className="h-3 w-12 bg-white/10 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {/* Title skeleton */}
              <div className={cn("h-6 bg-white/10 rounded animate-pulse mb-2", config.titleSize)} />

              {/* Subtitle skeleton */}
              {subtitle && (
                <div className={cn("h-4 bg-white/5 rounded animate-pulse mb-1", config.subtitleSize)} />
              )}

              {/* Description skeleton */}
              {description && (
                <div className={cn("h-3 bg-white/5 rounded animate-pulse", config.descriptionSize)} />
              )}
            </div>

            {/* Actions skeleton */}
            {actions && (
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <div className="h-8 w-20 bg-white/10 rounded animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "relative rounded-2xl",
        variantClasses[variant],
        config.padding,
        config.spacing,
        className
      )}
    >
      <div className="flex flex-col gap-4">
        {/* Header content */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.3 }}
                className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mb-2"
                aria-label="Navegación de migas de pan"
              >
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-[var(--color-text-disabled)]">/</span>}
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-[var(--color-text-primary)] font-medium">
                        {crumb.label}
                      </span>
                    )}
                  </div>
                ))}
              </motion.nav>
            )}

            {/* Title with gradient */}
            <h1
              className={cn(
                "font-bold tracking-tight font-satoshi",
                config.titleSize,
                "bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent"
              )}
              style={{
                backgroundImage: "linear-gradient(135deg, var(--color-text-primary) 0%, var(--color-text-secondary) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}
              role="heading"
              aria-level={1}
            >
              {title}
            </h1>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className={cn(
                  "mt-1.5 font-medium",
                  config.subtitleSize,
                  "text-[var(--color-text-secondary)] font-inter"
                )}
                aria-label={`Subtítulo: ${subtitle}`}
              >
                {subtitle}
              </motion.p>
            )}

            {/* Description */}
            {description && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className={cn(
                  "mt-2 max-w-2xl",
                  config.descriptionSize,
                  "text-[var(--color-text-secondary)] font-inter leading-relaxed"
                )}
                aria-label={`Descripción: ${description}`}
              >
                {description}
              </motion.p>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 flex-shrink-0"
              role="toolbar"
              aria-label="Acciones del encabezado"
            >
              {actions}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const PageHeader = memo(PageHeaderComponent);
export const CompactPageHeader = memo((props: Omit<PageHeaderProps, "size">) => (
  <PageHeaderComponent {...props} size="sm" />
));
