"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { Booking } from "@/types/agenda";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { scoreBookingMatch } from "@/lib/search-utils";
import { cn } from "@/lib/utils";

interface AgendaSearchResultsProps {
  term: string;
  bookings: Booking[];
  timezone: string;
  onBookingClick: (booking: Booking) => void;
  onContextMenu?: (e: React.MouseEvent, booking: Booking) => void;
}

function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function bookingDayKey(b: Booking, timezone: string): string {
  return format(
    new Date(new Date(b.starts_at).toLocaleString("en-US", { timeZone: timezone })),
    "yyyy-MM-dd"
  );
}

export function AgendaSearchResults({
  term,
  bookings,
  timezone,
  onBookingClick,
  onContextMenu,
}: AgendaSearchResultsProps) {
  const today = todayKey();

  const results = useMemo(() => {
    if (!term.trim()) return { today: [], past: [], future: [] };

    const scored = bookings
      .map((b) => ({
        booking: b,
        score: scoreBookingMatch(term, [
          b.customer?.name,
          b.customer?.phone,
          b.service?.name,
          b.staff?.name,
        ]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.booking.starts_at).getTime() - new Date(b.booking.starts_at).getTime();
      });

    const nowMs = Date.now();
    const todayResults: Booking[] = [];
    const pastResults: Booking[] = [];
    const futureResults: Booking[] = [];

    for (const { booking } of scored) {
      const dayKey = bookingDayKey(booking, timezone);
      const startMs = new Date(booking.starts_at).getTime();

      if (dayKey === today) {
        todayResults.push(booking);
      } else if (startMs < nowMs) {
        pastResults.push(booking);
      } else {
        futureResults.push(booking);
      }
    }

    // Past most recent first
    pastResults.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    // Future soonest first
    futureResults.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    return { today: todayResults, past: pastResults, future: futureResults };
  }, [term, bookings, timezone, today]);

  const total = results.today.length + results.past.length + results.future.length;
  const hasToday = results.today.length > 0;
  const showColumns = !hasToday && (results.past.length > 0 || results.future.length > 0);

  if (!term.trim()) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={term}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-3 scrollbar-hide"
      >
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--bf-bg-elev)] border border-[var(--bf-border)] flex items-center justify-center">
              <Search className="h-5 w-5 text-[var(--bf-ink-400)]" />
            </div>
            <p className="text-sm font-medium text-[var(--bf-ink-300)]">
              Sin resultados para <span className="text-[var(--bf-ink-100)]">"{term}"</span>
            </p>
            <p className="text-xs text-[var(--bf-ink-400)] text-center max-w-xs">
              Prueba con otro nombre, teléfono o servicio
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Today results — priority section */}
            {hasToday && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold tracking-wider text-[var(--bf-primary)] uppercase">
                    Hoy
                  </span>
                  <div className="h-px flex-1 bg-[var(--bf-primary)]/15" />
                  <span className="text-[10px] text-[var(--bf-ink-400)]">
                    {results.today.length} {results.today.length === 1 ? "cita" : "citas"}
                  </span>
                </div>
                <div className="space-y-2">
                  {results.today.map((b) => (
                    <AppointmentCard
                      key={b.id}
                      booking={b}
                      timezone={timezone}
                      variant="desktop-list"
                      onClick={() => onBookingClick(b)}
                      onContextMenu={(e) => onContextMenu?.(e, b)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Two-column layout: past | future (when no today results) */}
            {showColumns && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Past */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold tracking-wider text-[var(--bf-ink-400)] uppercase">
                      Anteriores
                    </span>
                    <div className="h-px flex-1 bg-[var(--bf-border)]/60" />
                    {results.past.length > 0 && (
                      <span className="text-[10px] text-[var(--bf-ink-400)]">
                        {results.past.length}
                      </span>
                    )}
                  </div>
                  {results.past.length > 0 ? (
                    <div className="space-y-2">
                      {results.past.slice(0, 8).map((b) => (
                        <AppointmentCard
                          key={b.id}
                          booking={b}
                          timezone={timezone}
                          variant="desktop-list"
                          onClick={() => onBookingClick(b)}
                          onContextMenu={(e) => onContextMenu?.(e, b)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--bf-ink-400)] py-4 text-center">Sin citas anteriores</p>
                  )}
                </section>

                {/* Future */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold tracking-wider text-[var(--bf-ink-200)] uppercase">
                      Próximas
                    </span>
                    <div className="h-px flex-1 bg-[var(--bf-primary)]/20" />
                    {results.future.length > 0 && (
                      <span className="text-[10px] text-[var(--bf-ink-400)]">
                        {results.future.length}
                      </span>
                    )}
                  </div>
                  {results.future.length > 0 ? (
                    <div className="space-y-2">
                      {results.future.slice(0, 8).map((b) => (
                        <AppointmentCard
                          key={b.id}
                          booking={b}
                          timezone={timezone}
                          variant="desktop-list"
                          onClick={() => onBookingClick(b)}
                          onContextMenu={(e) => onContextMenu?.(e, b)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--bf-ink-400)] py-4 text-center">Sin citas próximas</p>
                  )}
                </section>
              </div>
            )}

            {/* If today results exist AND also past/future */}
            {hasToday && (results.past.length > 0 || results.future.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {results.past.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold tracking-wider text-[var(--bf-ink-400)] uppercase">Anteriores</span>
                      <div className="h-px flex-1 bg-[var(--bf-border)]/60" />
                      <span className="text-[10px] text-[var(--bf-ink-400)]">{results.past.length}</span>
                    </div>
                    <div className="space-y-2">
                      {results.past.slice(0, 5).map((b) => (
                        <AppointmentCard key={b.id} booking={b} timezone={timezone} variant="desktop-list"
                          onClick={() => onBookingClick(b)} onContextMenu={(e) => onContextMenu?.(e, b)} />
                      ))}
                    </div>
                  </section>
                )}
                {results.future.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold tracking-wider text-[var(--bf-ink-200)] uppercase">Próximas</span>
                      <div className="h-px flex-1 bg-[var(--bf-primary)]/20" />
                      <span className="text-[10px] text-[var(--bf-ink-400)]">{results.future.length}</span>
                    </div>
                    <div className="space-y-2">
                      {results.future.slice(0, 5).map((b) => (
                        <AppointmentCard key={b.id} booking={b} timezone={timezone} variant="desktop-list"
                          onClick={() => onBookingClick(b)} onContextMenu={(e) => onContextMenu?.(e, b)} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
