"use client";

import { ReactNode } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type CustomerBookingStatus =
  | "hold"
  | "pending"
  | "paid"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type CustomerBooking = {
  id: string;
  starts_at: string;
  ends_at?: string | null;
  status: CustomerBookingStatus;
  service?: {
    name: string;
    price_cents?: number | null;
  } | null;
  staff?: {
    name: string | null;
  } | null;
};

interface CustomerBookingsTimelineProps {
  bookings: CustomerBooking[];
  tenantTimezone?: string;
  renderAction?: (booking: CustomerBooking) => ReactNode;
}

const formatBookingDate = (date: string, timezone: string) =>
  formatInTimeZone(date, timezone, "EEEE d 'de' MMMM · HH:mm", { locale: es });

export function CustomerBookingsTimeline({
  bookings,
  tenantTimezone = "Europe/Madrid",
  renderAction,
}: CustomerBookingsTimelineProps) {
  if (bookings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const isNoShow = booking.status === "no_show";
        return (
          <div
            key={booking.id}
            className={`p-4 rounded-[var(--radius-lg)] glass hover:shadow-glass transition-smooth ${
              isNoShow ? "border-2 border-dashed border-amber-500/30 bg-amber-500/5" : ""
            }`}
            style={{ borderRadius: "var(--radius-lg)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] font-satoshi">
                    {formatBookingDate(booking.starts_at, tenantTimezone)}
                  </span>
                  <StatusBadge status={booking.status} size="sm" />
                  {isNoShow && (
                    <span className="text-xs text-amber-400 font-medium">⚠️ No-show</span>
                  )}
                </div>
              {booking.service?.name && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {booking.service.name}
                </p>
              )}
              {booking.staff?.name && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  👤 {booking.staff.name}
                </p>
              )}
              {typeof booking.service?.price_cents === "number" && (
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  💰 {(booking.service.price_cents / 100).toFixed(2)} €
                </p>
              )}
            </div>
            {renderAction && <div className="flex-shrink-0">{renderAction(booking)}</div>}
          </div>
        </div>
        );
      })}
    </div>
  );
}

