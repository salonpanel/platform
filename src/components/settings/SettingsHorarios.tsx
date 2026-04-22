"use client";

import { GlassSection, GlassButton } from "@/components/ui/glass";

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface DaySchedule {
  open: string;
  close: string;
  is_closed: boolean;
}

export type BusinessHours = Record<DayKey, DaySchedule>;

const DAY_LABELS: Record<DayKey, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const DAYS_ORDER: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const totalMins = i * 30;
  const h = Math.floor(totalMins / 60).toString().padStart(2, "0");
  const m = (totalMins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday:    { open: "09:00", close: "20:00", is_closed: false },
  tuesday:   { open: "09:00", close: "20:00", is_closed: false },
  wednesday: { open: "09:00", close: "20:00", is_closed: false },
  thursday:  { open: "09:00", close: "20:00", is_closed: false },
  friday:    { open: "09:00", close: "20:00", is_closed: false },
  saturday:  { open: "10:00", close: "18:00", is_closed: false },
  sunday:    { open: "10:00", close: "14:00", is_closed: true  },
};

interface SettingsHorariosProps {
  businessHours: BusinessHours;
  onChange: (hours: BusinessHours) => void;
  onSave: () => void;
  isLoading: boolean;
}

export function SettingsHorarios({ businessHours, onChange, onSave, isLoading }: SettingsHorariosProps) {
  const updateDay = (day: DayKey, field: keyof DaySchedule, value: string | boolean) => {
    onChange({
      ...businessHours,
      [day]: { ...businessHours[day], [field]: value },
    });
  };

  const copyToAllWeekdays = () => {
    const mon = businessHours.monday;
    const updated = { ...businessHours };
    (["tuesday", "wednesday", "thursday", "friday"] as DayKey[]).forEach((d) => {
      updated[d] = { ...mon };
    });
    onChange(updated);
  };

  return (
    <GlassSection
      title="Horarios de Apertura"
      description="Define los días y horas en que tu negocio está abierto al público."
    >
      <div className="space-y-1">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[minmax(140px,1fr)_minmax(110px,140px)_minmax(110px,140px)_72px] gap-3 px-4 pb-1">
          <span className="text-[11px] uppercase tracking-wider text-[var(--bf-ink-300)] font-semibold">Día</span>
          <span className="text-[11px] uppercase tracking-wider text-[var(--bf-ink-300)] font-semibold">Apertura</span>
          <span className="text-[11px] uppercase tracking-wider text-[var(--bf-ink-300)] font-semibold">Cierre</span>
          <span className="text-[11px] uppercase tracking-wider text-[var(--bf-ink-300)] font-semibold text-right">Cerrado</span>
        </div>

        {/* Day rows */}
        {DAYS_ORDER.map((day) => {
          const schedule = businessHours[day] ?? DEFAULT_BUSINESS_HOURS[day];
          const isClosed = schedule.is_closed;
          return (
            <div
              key={day}
              className={`rounded-xl px-4 py-3 transition-all duration-200 ${
                isClosed
                  ? "opacity-50 bg-white/2"
                  : "bg-white/5 hover:bg-white/8"
              }`}
            >
              {/* Mobile: day + toggle on top, selects below. Desktop: single grid row */}
              <div className="flex items-center justify-between gap-3 sm:hidden">
                <span className={`text-sm font-medium ${isClosed ? "text-[var(--bf-ink-300)]" : "text-white"}`}>
                  {DAY_LABELS[day]}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--bf-ink-300)]">Cerrado</span>
                  <button
                    type="button"
                    onClick={() => updateDay(day, "is_closed", !isClosed)}
                    disabled={isLoading}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
                      isClosed ? "bg-red-500/60" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        isClosed ? "translate-x-4.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:hidden">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--bf-ink-300)] font-semibold">Apertura</p>
                  <select
                    value={schedule.open}
                    onChange={(e) => updateDay(day, "open", e.target.value)}
                    disabled={isClosed || isLoading}
                    className="h-9 w-full rounded-lg bg-white/8 border border-white/10 text-sm text-white px-2 focus:outline-none focus:border-[var(--bf-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t} className="bg-[#1a1a2e]">{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--bf-ink-300)] font-semibold">Cierre</p>
                  <select
                    value={schedule.close}
                    onChange={(e) => updateDay(day, "close", e.target.value)}
                    disabled={isClosed || isLoading}
                    className="h-9 w-full rounded-lg bg-white/8 border border-white/10 text-sm text-white px-2 focus:outline-none focus:border-[var(--bf-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t} className="bg-[#1a1a2e]">{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="hidden sm:grid grid-cols-[minmax(140px,1fr)_minmax(110px,140px)_minmax(110px,140px)_72px] gap-3 items-center">
                {/* Day label */}
                <span className={`text-sm font-medium ${isClosed ? "text-[var(--bf-ink-300)]" : "text-white"}`}>
                  {DAY_LABELS[day]}
                </span>

                {/* Open time */}
                <select
                  value={schedule.open}
                  onChange={(e) => updateDay(day, "open", e.target.value)}
                  disabled={isClosed || isLoading}
                  className="h-9 w-full rounded-lg bg-white/8 border border-white/10 text-sm text-white px-2 focus:outline-none focus:border-[var(--bf-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t} className="bg-[#1a1a2e]">{t}</option>
                  ))}
                </select>

                {/* Close time */}
                <select
                  value={schedule.close}
                  onChange={(e) => updateDay(day, "close", e.target.value)}
                  disabled={isClosed || isLoading}
                  className="h-9 w-full rounded-lg bg-white/8 border border-white/10 text-sm text-white px-2 focus:outline-none focus:border-[var(--bf-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t} className="bg-[#1a1a2e]">{t}</option>
                  ))}
                </select>

                {/* Closed toggle */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => updateDay(day, "is_closed", !isClosed)}
                    disabled={isLoading}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
                      isClosed ? "bg-red-500/60" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        isClosed ? "translate-x-4.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-4">
        <button
          type="button"
          onClick={copyToAllWeekdays}
          disabled={isLoading}
          className="text-xs text-[var(--bf-primary)] hover:text-white transition-colors disabled:opacity-40"
        >
          Copiar Lunes a todos los días laborables
        </button>
        <GlassButton
          onClick={onSave}
          isLoading={isLoading}
          className="h-10 px-5"
        >
          Guardar Horarios
        </GlassButton>
      </div>
    </GlassSection>
  );
}
