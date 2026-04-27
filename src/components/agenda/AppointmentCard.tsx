"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Booking, BOOKING_STATUS_CONFIG, getBookingPresentation } from "@/types/agenda";
import { formatInTenantTz } from "@/lib/timezone";
import { theme } from "@/theme/ui";
import { getMotionSafeProps, interactionPresets } from "./motion/presets";

interface AppointmentCardProps {
  booking: Booking;
  timezone: string;
  compact?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  variant?: "timeline" | "list" | "grid" | "desktop-list";
  showStatus?: boolean;
  showPrice?: boolean;
  className?: string;
  staffColor?: string | null;
  /** Optional override for "now" — defaults to Date.now() at render time */
  nowMs?: number;
}

// ─── Live-state helpers ───────────────────────────────────────────────────────

function getDayKey(dateMs: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(dateMs));
}

interface LiveState {
  isToday: boolean;
  isCurrentWindow: boolean; // now is between start and end
  isLate10: boolean;        // confirmed/pending, >10 min after start
  isLate20: boolean;        // confirmed/pending, >20 min after start — pulsing
  isOverdue: boolean;       // past end time, still pending/confirmed (show ¿Vino? badge)
}

function computeLiveState(booking: Booking, timezone: string, nowMs: number): LiveState {
  const startMs = new Date(booking.starts_at).getTime();
  const endMs   = new Date(booking.ends_at).getTime();

  const todayKey   = getDayKey(nowMs, timezone);
  const bookingDay = getDayKey(startMs, timezone);
  const isToday    = todayKey === bookingDay;

  const state = (booking.booking_state ?? "pending");
  const isActionable = state === "pending" || state === "confirmed";

  if (!isToday || !isActionable) {
    return { isToday, isCurrentWindow: false, isLate10: false, isLate20: false, isOverdue: false };
  }

  const isCurrentWindow = nowMs >= startMs && nowMs <= endMs;
  const lateMs          = nowMs > startMs ? nowMs - startMs : 0;
  const isLate10        = lateMs > 10 * 60_000;
  const isLate20        = lateMs > 20 * 60_000;
  const isOverdue       = nowMs > endMs;

  return { isToday, isCurrentWindow, isLate10, isLate20, isOverdue };
}

// ─── State-based card styles ──────────────────────────────────────────────────

interface CardTokens {
  bg: string;
  border: string;
  text: string;
  shadow: string;
  opacity: number;
}

function getStateTokens(
  booking: Booking,
  live: LiveState,
  staffColor: string | null | undefined,
): CardTokens {
  const state = booking.booking_state ?? "pending";
  const presentation = getBookingPresentation(booking);
  const fallbackText = presentation.bookingStateConfig.legendColor;
  const accentColor  = staffColor || fallbackText;

  // Terminal states — dim heavily
  if (state === "cancelled") {
    return {
      bg:      "rgba(60,60,65,0.06)",
      border:  "rgba(80,85,90,0.40)",
      text:    "#6B7280",
      shadow:  "none",
      opacity: 0.45,
    };
  }

  if (state === "completed") {
    return {
      bg:      "rgba(80,90,100,0.08)",
      border:  staffColor ?? "#4B5563",
      text:    "#6B7280",
      shadow:  "none",
      opacity: 0.58,
    };
  }

  if (state === "no_show") {
    return {
      bg:      "rgba(224,96,114,0.10)",
      border:  "#E06072",
      text:    "#E06072",
      shadow:  "0 1px 4px rgba(224,96,114,0.12)",
      opacity: 0.60,
    };
  }

  // Arrived — client is here waiting (amber warm)
  if (state === "arrived") {
    return {
      bg:      "rgba(245,158,11,0.14)",
      border:  "#F59E0B",
      text:    "#F59E0B",
      shadow:  "0 0 0 1px rgba(245,158,11,0.28)",
      opacity: 1,
    };
  }

  // In-progress — service is happening (violet)
  if (state === "in_progress") {
    return {
      bg:      "rgba(167,139,250,0.14)",
      border:  "#A78BFA",
      text:    "#A78BFA",
      shadow:  "0 0 0 1px rgba(167,139,250,0.28)",
      opacity: 1,
    };
  }

  // Live time-based overrides for pending / confirmed
  if (live.isLate20) {
    return {
      bg:      "rgba(245,158,11,0.14)",
      border:  "#F59E0B",
      text:    accentColor,
      shadow:  "0 0 0 1px rgba(245,158,11,0.30)",
      opacity: 1,
    };
  }

  if (live.isLate10) {
    return {
      bg:      "rgba(245,158,11,0.09)",
      border:  "#F59E0B",
      text:    accentColor,
      shadow:  "0 0 0 1px rgba(245,158,11,0.20)",
      opacity: 1,
    };
  }

  if (live.isCurrentWindow) {
    return {
      bg:      `${presentation.bookingStateConfig.legendBg}`,
      border:  fallbackText,
      text:    accentColor,
      shadow:  `0 0 0 1px ${fallbackText}28, 0 2px 8px ${fallbackText}18`,
      opacity: 1,
    };
  }

  // Default
  const rawToken = (theme.statusTokens as Record<string, { bg: string; border: string; text: string; shadow: string } | undefined>)[state] ?? theme.statusTokens.pending;
  const statusTokens: CardTokens = { ...rawToken, opacity: 1 };
  return {
    bg:      statusTokens.bg,
    border:  accentColor,
    text:    statusTokens.text,
    shadow:  `0 1px 6px ${statusTokens.text}12`,
    opacity: 1,
  };
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
  staffColor,
  nowMs: nowMsProp,
}: AppointmentCardProps) {
  const nowMs = nowMsProp ?? Date.now();
  const startTime = formatInTenantTz(booking.starts_at, timezone, "HH:mm");
  const endTime   = formatInTenantTz(booking.ends_at,   timezone, "HH:mm");

  const presentation = getBookingPresentation(booking);
  const live         = computeLiveState(booking, timezone, nowMs);
  const tokens       = getStateTokens(booking, live, staffColor);

  const baseClasses = cn(
    "relative backdrop-blur-md border-l-[3px] rounded-[10px] cursor-pointer",
    "transition-colors duration-200 group",
    "focus:outline-none focus:ring-2 focus:ring-[rgba(79,161,216,0.4)] focus:ring-offset-2 focus:ring-offset-[var(--bf-bg)]",
    "min-h-[44px]",
    variant === "timeline" ? "w-full h-full" : "w-full",
    live.isLate20 ? "bf-card-late-pulse" : "",
    className
  );

  const cardStyle: React.CSSProperties = {
    background:    tokens.bg,
    borderLeftColor: tokens.border,
    boxShadow:     tokens.shadow,
    borderRadius:  "10px",
    opacity:       tokens.opacity,
  };

  // Small "¿Vino?" badge for overdue bookings
  const OverdueBadge = live.isOverdue ? (
    <span
      className="absolute top-1 right-1 z-10 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5
                 text-[9px] font-bold tracking-wide bg-[rgba(245,158,11,0.20)] text-[#F59E0B]
                 border border-[rgba(245,158,11,0.45)] pointer-events-none"
    >
      ¿Vino?
    </span>
  ) : null;

  // Small "retraso" badge (10+ min but not yet 20)
  const LateBadge = (live.isLate10 && !live.isLate20 && !live.isOverdue) ? (
    <span
      className="absolute top-1 right-1 z-10 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5
                 text-[9px] font-bold tracking-wide bg-[rgba(245,158,11,0.15)] text-[#F59E0B]
                 border border-[rgba(245,158,11,0.35)] pointer-events-none"
    >
      +10
    </span>
  ) : null;

  // "Ha llegado" badge for arrived state
  const ArrivedBadge = booking.booking_state === "arrived" ? (
    <span
      className="absolute top-1 right-1 z-10 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5
                 text-[9px] font-bold tracking-wide bg-[rgba(245,158,11,0.20)] text-[#F59E0B]
                 border border-[rgba(245,158,11,0.45)] pointer-events-none"
    >
      Aquí
    </span>
  ) : null;

  // ─── Timeline variant ──────────────────────────────────────────────────────
  if (variant === "timeline") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, scale: 0.97 },
          animate: { opacity: tokens.opacity, scale: 1 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        tabIndex={0}
        role="button"
        className={baseClasses}
        style={cardStyle}
        aria-label={`${startTime} - ${booking.customer?.name || "Sin cliente"} - ${booking.service?.name || "Sin servicio"}`}
      >
        {OverdueBadge ?? ArrivedBadge ?? LateBadge}
        <div className="h-full flex flex-col justify-center px-2.5 py-1 gap-0.5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-mono font-medium flex-shrink-0 text-[var(--bf-primary)]">
              {startTime}
            </span>
            <span className="text-xs font-semibold truncate flex-1 min-w-0 text-[var(--bf-ink-50)]">
              {booking.customer?.name || "Sin cliente"}
            </span>
          </div>
          {booking.service?.name && (
            <span className="text-[10px] text-[var(--bf-ink-400)] truncate leading-none">
              {booking.service.name}
            </span>
          )}
          {showStatus && (
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: presentation.bookingStateConfig.legendBg,
                  color: presentation.bookingStateConfig.legendColor,
                  border: `1px solid ${presentation.bookingStateConfig.legendBorder}`,
                }}
              >
                {presentation.bookingStateConfig.label}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: presentation.paymentStatusConfig.legendBg,
                  color: presentation.paymentStatusConfig.legendColor,
                  border: `1px solid ${presentation.paymentStatusConfig.legendBorder}`,
                }}
              >
                {presentation.paymentStatusConfig.shortLabel}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ─── List variant ──────────────────────────────────────────────────────────
  if (variant === "list") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 8 },
          animate: { opacity: tokens.opacity, y: 0 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "p-4")}
        style={cardStyle}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime} - ${endTime}`}
      >
        {OverdueBadge ?? ArrivedBadge ?? LateBadge}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="text-sm font-semibold font-mono text-[var(--bf-primary)]">
              {startTime} - {endTime}
            </div>
            {showStatus && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.border }} />
                <span className="text-xs font-medium text-[var(--bf-ink-300)]">
                  {presentation.bookingStateConfig.label}
                </span>
              </div>
            )}
          </div>
          <div className="text-base font-semibold text-[var(--bf-ink-50)]">
            {booking.customer?.name || "Sin cliente"}
          </div>
          <div className="text-sm text-[var(--bf-ink-300)]">
            {booking.service?.name || "Sin servicio"}
            {booking.service && ` • ${booking.service.duration_min} min`}
            {booking.staff && ` • ${booking.staff.name}`}
          </div>
          {showPrice && booking.service && (
            <div className="text-sm font-semibold pt-2 border-t border-[var(--bf-border)] text-[var(--bf-ink-50)]">
              {(booking.service.price_cents / 100).toFixed(2)} €
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ─── Desktop-list variant ──────────────────────────────────────────────────
  if (variant === "desktop-list") {
    const durationMin = booking.service?.duration_min
      ?? Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000);

    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, y: 6 },
          animate: { opacity: tokens.opacity, y: 0 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "px-4 py-3 flex items-center gap-4 min-h-[60px]")}
        style={cardStyle}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
      >
        {OverdueBadge ?? ArrivedBadge ?? LateBadge}

        {/* Time + duration */}
        <div className="flex-shrink-0 w-[110px]">
          <div className="text-sm font-mono font-semibold text-[var(--bf-primary)]">
            {startTime} <span className="text-[var(--bf-ink-400)]">-</span> {endTime}
          </div>
          <div className="text-[11px] text-[var(--bf-ink-400)] mt-0.5">{durationMin} min</div>
        </div>

        {/* Customer */}
        <div className="flex-shrink-0 w-[190px] min-w-0">
          <div className="text-sm font-semibold text-[var(--bf-ink-50)] truncate">
            {booking.customer?.name || "Sin cliente"}
          </div>
          {booking.customer?.phone && (
            <div className="text-[11px] text-[var(--bf-ink-400)] truncate mt-0.5">
              {booking.customer.phone}
            </div>
          )}
        </div>

        {/* Service */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[var(--bf-ink-200)] truncate">
            {booking.service?.name || "Sin servicio"}
          </div>
          {booking.staff?.name && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.border }} />
              <span className="text-[11px] text-[var(--bf-ink-400)] truncate">{booking.staff.name}</span>
            </div>
          )}
        </div>

        {/* Status badges */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
            style={{
              backgroundColor: presentation.bookingStateConfig.legendBg,
              color: presentation.bookingStateConfig.legendColor,
              border: `1px solid ${presentation.bookingStateConfig.legendBorder}`,
            }}
          >
            {presentation.bookingStateConfig.label}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
            style={{
              backgroundColor: presentation.paymentStatusConfig.legendBg,
              color: presentation.paymentStatusConfig.legendColor,
              border: `1px solid ${presentation.paymentStatusConfig.legendBorder}`,
            }}
          >
            {presentation.paymentStatusConfig.shortLabel}
          </span>
        </div>

        {/* Price */}
        {booking.service?.price_cents != null && (
          <div className="flex-shrink-0 w-[60px] text-right">
            <span className="text-sm font-semibold text-[var(--bf-ink-50)]">
              {(booking.service.price_cents / 100).toFixed(0)}€
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  // ─── Grid variant ──────────────────────────────────────────────────────────
  if (variant === "grid") {
    return (
      <motion.div
        {...getMotionSafeProps({
          initial: { opacity: 0, x: -4 },
          animate: { opacity: tokens.opacity, x: 0 },
          whileHover: interactionPresets.appointmentCard.hover,
          whileTap: interactionPresets.appointmentCard.tap,
        })}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        tabIndex={0}
        role="button"
        className={cn(baseClasses, "p-1.5")}
        style={cardStyle}
        aria-label={`Cita de ${booking.customer?.name || "cliente"} a las ${startTime}`}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tokens.text }} />
          <span className="text-xs font-semibold font-mono flex-shrink-0 text-[var(--bf-primary)]">{startTime}</span>
          <span className="text-xs font-medium truncate text-[var(--bf-ink-50)]">
            {getCustomerInitials(booking.customer?.name)}
          </span>
        </div>
      </motion.div>
    );
  }

  return null;
}

function getCustomerInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default AppointmentCard;
