"use client";

import type { ReactNode } from "react";
import { GlassSection, GlassButton } from "@/components/ui/glass";
import { CalendarClock, Clock4, Shield } from "lucide-react";

interface SettingsReservasProps {
  slotDurationMin: number;
  bufferBetweenBookingsMin: number;
  cancellationHoursNotice: number;
  bookingWindowDays: number;
  onChange: (field: string, value: number) => void;
  onSave: () => void;
  isLoading: boolean;
}

const SLOT_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
];

const BUFFER_OPTIONS = [
  { value: 0,  label: "Sin buffer" },
  { value: 5,  label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
];

const CANCEL_OPTIONS = [
  { value: 0,   label: "Sin restricción" },
  { value: 2,   label: "2 horas de antelación" },
  { value: 6,   label: "6 horas de antelación" },
  { value: 12,  label: "12 horas de antelación" },
  { value: 24,  label: "24 horas de antelación" },
  { value: 48,  label: "48 horas de antelación" },
  { value: 72,  label: "72 horas de antelación" },
];

const WINDOW_OPTIONS = [
  { value: 7,   label: "1 semana" },
  { value: 14,  label: "2 semanas" },
  { value: 30,  label: "1 mes" },
  { value: 60,  label: "2 meses" },
  { value: 90,  label: "3 meses" },
  { value: 180, label: "6 meses" },
];

interface SelectRowProps {
  label: string;
  description: string;
  icon: ReactNode;
  value: number;
  options: { value: number; label: string }[];
  field: string;
  onChange: (field: string, value: number) => void;
  disabled: boolean;
}

function SelectRow({ label, description, icon, value, options, field, onChange, disabled }: SelectRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3.5 hover:bg-white/8 transition-colors">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="text-[var(--bf-primary)] mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-[var(--bf-ink-300)] mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(field, Number(e.target.value))}
        disabled={disabled}
        className="h-9 w-44 shrink-0 rounded-lg bg-white/10 border border-white/15 text-sm text-white px-2 focus:outline-none focus:border-[var(--bf-primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SettingsReservas({
  slotDurationMin,
  bufferBetweenBookingsMin,
  cancellationHoursNotice,
  bookingWindowDays,
  onChange,
  onSave,
  isLoading,
}: SettingsReservasProps) {
  return (
    <GlassSection
      title="Configuración de Reservas"
      description="Define cómo funciona el sistema de citas en tu negocio."
    >
      <div className="space-y-2">
        <SelectRow
          label="Duración del slot"
          description="La unidad de tiempo mínima en la agenda. Afecta a cómo se dividen los huecos disponibles."
          icon={<Clock4 className="w-4 h-4" />}
          value={slotDurationMin}
          options={SLOT_OPTIONS}
          field="slot_duration_min"
          onChange={onChange}
          disabled={isLoading}
        />

        <SelectRow
          label="Buffer entre citas"
          description="Tiempo de preparación automático después de cada cita. Útil para limpiar el puesto."
          icon={<Clock4 className="w-4 h-4" />}
          value={bufferBetweenBookingsMin}
          options={BUFFER_OPTIONS}
          field="buffer_between_bookings_min"
          onChange={onChange}
          disabled={isLoading}
        />

        <SelectRow
          label="Antelación mínima para cancelar"
          description="Los clientes no podrán cancelar una cita por debajo de este tiempo. Ayuda a reducir el no-show."
          icon={<Shield className="w-4 h-4" />}
          value={cancellationHoursNotice}
          options={CANCEL_OPTIONS}
          field="cancellation_hours_notice"
          onChange={onChange}
          disabled={isLoading}
        />

        <SelectRow
          label="Ventana de reserva online"
          description="Con cuánta antelación máxima pueden reservar los clientes desde el portal público."
          icon={<CalendarClock className="w-4 h-4" />}
          value={bookingWindowDays}
          options={WINDOW_OPTIONS}
          field="booking_window_days"
          onChange={onChange}
          disabled={isLoading}
        />
      </div>

      <div className="pt-4 flex justify-end border-t border-white/10 mt-2">
        <GlassButton onClick={onSave} isLoading={isLoading} className="h-10 px-5">
          Guardar Reservas
        </GlassButton>
      </div>
    </GlassSection>
  );
}
