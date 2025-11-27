"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking, BOOKING_STATUS_CONFIG } from "@/types/agenda";
import { formatInTenantTz } from "@/lib/timezone";
import { theme } from "@/theme/ui";
import { getMotionSafeProps, interactionPresets } from "./motion/presets";

interface AppointmentCardProps {
  booking: Booking;
  timezone: string;
  compact?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  variant?: "timeline" | "list" | "grid";
  showStatus?: boolean;
  showPrice?: boolean;
  className?: string;
}

/**
 * Unified AppointmentCard component with premium design tokens
 * Used across all calendar views for consistent booking display
 */
export function AppointmentCard({
  booking,
  timezone,
  compact = false,
  onClick,
  onContextMenu,
  variant = "timeline",
  showStatus = true,
  showPrice = false,
  className = "",
}: AppointmentCardProps) {
  const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
  const endTime = formatInTenantTz(booking.ends_at, timezone, "HH:mm");
  const statusConfig = BOOKING_STATUS_CONFIG[booking.status] || BOOKING_STATUS_CONFIG.pending;

  // Get theme-based status colors with fallbacks for missing statuses
  const statusTokens = theme.statusTokens?.[booking.status as keyof typeof theme.statusTokens] || 
    theme.statusTokens?.pending || {
      bg: "rgba(255, 193, 7, 0.12)",
      border: "rgba(255, 193, 7, 0.25)", 
      text: "#FFC107",
      shadow: "0px 2px 8px rgba(255, 193, 7, 0.15)"
    };

  // Base card styling with premium glassmorphism and mobile-first responsive design
  const baseClasses = cn(
    "relative backdrop-blur-md border-l-4 rounded-xl cursor-pointer",
    "transition-all duration-200 group",
    "focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]",
    // Phase 3: Mobile-first responsive improvements
    "min-h-[44px]", // Ensure 44px minimum tap target (padding handled per variant)
    variant === "timeline" ? "absolute left-2 right-2" : "w-full",
    className
  );

  const cardStyle = {
    background: statusTokens.bg,
    borderLeftColor: statusTokens.border,
    boxShadow: "var(--shadow-premium)",
  };

  // Timeline variant (for WeekView timeline positioning)
  if (variant === "timeline") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        tabIndex={0}
        role="button"
        className={baseClasses}
        style={cardStyle}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${booking.service?.name || "Sin servicio"}`}
      >
        <div className="p-3 md:p-4 space-y-2 md:space-y-3">
          {/* Time - Enhanced prominence for better hierarchy */}
          <div className={cn(
            "text-sm md:text-base font-semibold font-mono",
            "text-[var(--text-secondary)]",
            "tracking-tight" // Better readability
          )}>
            {startTime}
          </div>
          
          {/* Customer - Primary information */}
          <div className={cn(
            "text-sm md:text-base font-semibold truncate",
            "text-[var(--text-primary)] font-[var(--font-heading)]",
            "leading-tight" // Better line height for mobile
          )}>
            {booking.customer?.name || "Sin cliente"}
          </div>
          
          {/* Service - Enhanced display with better mobile spacing */}
          {!compact && booking.service?.name && (
            <div className={cn(
              "text-xs md:text-sm truncate",
              "text-[var(--text-secondary)] font-[var(--font-body)]",
              "leading-relaxed" // Better readability on mobile
            )}>
              {booking.service.name}
            </div>
          )}
          
          {/* Status indicator - Refined design */}
          {showStatus && (
            <div className="flex items-center gap-2">
              <div 
                className={cn(
                  "w-2 h-2 rounded-full",
                  "bg-[var(--status-dot)]" // Use CSS custom property for consistency
                )}
                style={{ backgroundColor: statusTokens.border }}
              />
              <span className={cn(
                "text-xs font-medium",
                "text-[var(--text-tertiary)]"
              )}>
                {statusConfig.label}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // List variant (for ListView and mobile displays)
  if (variant === "list") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        tabIndex={0}
        role="button"
        className={cn(
          baseClasses,
          "p-4"
        )}
        style={cardStyle}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${endTime}`}
      >
        <div className="space-y-3">
          {/* Header: Time + Status */}
          <div className="flex items-start justify-between">
            <div className={cn(
              "text-sm font-semibold font-mono",
              "text-[var(--text-primary)]"
            )}>
              {startTime} - {endTime}
            </div>
            {showStatus && (
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: statusTokens.text }}
                />
                <span className={cn(
                  "text-xs font-medium",
                  "text-[var(--text-secondary)] font-[var(--font-body)]"
                )}>
                  {statusConfig.label}
                </span>
              </div>
            )}
          </div>

          {/* Customer name */}
          <div className={cn(
            "text-base font-semibold",
            "text-[var(--text-primary)] font-[var(--font-heading)]"
          )}>
            {booking.customer?.name || "Sin cliente"}
          </div>

          {/* Service details */}
          <div className={cn(
            "text-sm",
            "text-[var(--text-secondary)] font-[var(--font-body)]"
          )}>
            {booking.service?.name || "Sin servicio"}
            {booking.service && ` • ${booking.service.duration_min} min`}
            {booking.staff && ` • ${booking.staff.name}`}
          </div>

          {/* Price (if requested) */}
          {showPrice && booking.service && (
            <div className={cn(
              "text-sm font-semibold pt-2 border-t border-[var(--glass-border-subtle)]",
              "text-[var(--text-primary)] font-[var(--font-heading)]"
            )}>
              {(booking.service.price_cents / 100).toFixed(2)} €
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Grid variant (for MonthView grid cells)
  if (variant === "grid") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, x: -4 },
          animate: { opacity: 1, x: 0 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        tabIndex={0}
        role="button"
        className={cn(
          baseClasses,
          "p-1.5"
        )}
        style={cardStyle}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
      >
        <div className="flex items-center gap-1.5">
          {/* Status dot */}
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusTokens.text }}
          />
          
          {/* Time */}
          <span className={cn(
            "text-xs font-semibold font-mono flex-shrink-0",
            "text-[var(--text-secondary)]"
          )}>
            {startTime}
          </span>
          
          {/* Customer initials */}
          <span className={cn(
            "text-xs font-medium truncate",
            "text-[var(--text-primary)] font-[var(--font-body)]"
          )}>
            {getCustomerInitials(booking.customer?.name)}
          </span>
        </div>
      </motion.div>
    );
  }

  return null;
}

// Helper function to get customer initials
function getCustomerInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

export default AppointmentCard;
