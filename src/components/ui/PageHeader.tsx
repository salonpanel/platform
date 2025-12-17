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
      titleSize: "text-xl sm:text-2xl",
      subtitleSize: "text-sm",
      descriptionSize: "text-xs sm:text-sm",
      padding: "py-3 sm:py-4",
      spacing: "space-y-2"
    },
    md: {
      titleSize: "text-2xl sm:text-3xl",
      subtitleSize: "text-sm sm:text-base",
      descriptionSize: "text-xs sm:text-sm",
      padding: "py-4 sm:py-5",
      spacing: "space-y-3"
    },
    lg: {
      titleSize: "text-3xl sm:text-4xl",
      subtitleSize: "text-base sm:text-lg",
      descriptionSize: "text-sm sm:text-base",
      padding: "py-5 sm:py-6",
      spacing: "space-y-4"
    }
  };

  const config = sizeConfig[size];

  const variantClasses = {
    default: "",
    elevated: "bg-white/[0.02] backdrop-blur-sm border border-white/[0.06] rounded-2xl px-6 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
    glass: "bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-6 py-5",
    minimal: "bg-transparent border-none shadow-none"
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative",
          variantClasses[variant],
          config.padding,
          config.spacing,
          className
        )}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              {/* Breadcrumb skeleton */}
              {breadcrumbs && (
                <div className="flex items-center gap-2 text-xs">
                  {breadcrumbs.map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {index > 0 && <span className="text-white/20">/</span>}
                      <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {/* Title skeleton */}
              <div className={cn("h-8 bg-white/5 rounded-lg animate-pulse", config.titleSize)} />

              {/* Subtitle skeleton */}
              {subtitle && (
                <div className={cn("h-5 bg-white/5 rounded animate-pulse max-w-xs", config.subtitleSize)} />
              )}

              {/* Description skeleton */}
              {description && (
                <div className={cn("h-4 bg-white/5 rounded animate-pulse max-w-2xl", config.descriptionSize)} />
              )}
            </div>

            {/* Actions skeleton */}
            {actions && (
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <div className="h-10 w-24 bg-white/5 rounded-lg animate-pulse" />
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
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative",
        variantClasses[variant],
        config.padding,
        config.spacing,
        className
      )}
    >
      <div className="flex flex-col gap-6">
        {/* Header content */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="flex-1 min-w-0 space-y-4">
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2 text-xs text-white/50"
                aria-label="Navegación de migas de pan"
              >
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-white/20">/</span>}
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="hover:text-white/80 transition-colors duration-200 font-medium"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-white/90 font-semibold">
                        {crumb.label}
                      </span>
                    )}
                  </div>
                ))}
              </motion.nav>
            )}

            {/* Title with elegant gradient */}
            <h1
              className={cn(
                "font-bold tracking-tight font-satoshi",
                config.titleSize
              )}
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)",
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
                transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "font-medium",
                  config.subtitleSize,
                  "text-white/60 font-inter"
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
                transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "max-w-2xl",
                  config.descriptionSize,
                  "text-white/50 font-inter leading-relaxed"
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
              transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
PageHeader.displayName = 'PageHeader';

export const CompactPageHeader = memo((props: Omit<PageHeaderProps, "size">) => (
  <PageHeaderComponent {...props} size="sm" />
));
CompactPageHeader.displayName = 'CompactPageHeader';
