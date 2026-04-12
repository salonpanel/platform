"use client";

import type { ReactNode } from "react";
import { GlassSection, GlassButton } from "@/components/ui/glass";
import { MailCheck, MailX, Clock, AlarmClock, UserCheck } from "lucide-react";

export interface NotificationPrefs {
  notif_booking_confirmed: boolean;
  notif_booking_cancelled: boolean;
  notif_reminder_24h: boolean;
  notif_reminder_1h: boolean;
  notif_new_booking_owner: boolean;
}

interface SettingsNotificacionesProps {
  prefs: NotificationPrefs;
  onChange: (field: keyof NotificationPrefs, value: boolean) => void;
  onSave: () => void;
  isLoading: boolean;
}

interface ToggleRowProps {
  label: string;
  description: string;
  icon: ReactNode;
  field: keyof NotificationPrefs;
  value: boolean;
  onChange: (field: keyof NotificationPrefs, value: boolean) => void;
  disabled: boolean;
  badge?: string;
}

function ToggleRow({ label, description, icon, field, value, onChange, disabled, badge }: ToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 transition-all duration-200 cursor-pointer ${
        value ? "bg-white/5 hover:bg-white/8" : "bg-white/2 opacity-60 hover:opacity-80"
      }`}
      onClick={() => !disabled && onChange(field, !value)}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`mt-0.5 shrink-0 transition-colors ${value ? "text-[var(--accent-blue)]" : "text-[var(--text-secondary)]"}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium transition-colors ${value ? "text-white" : "text-[var(--text-secondary)]"}`}>
              {label}
            </p>
            {badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Toggle */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); onChange(field, !value); }}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
          value ? "bg-[var(--accent-blue)]" : "bg-white/20"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            value ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsNotificaciones({
  prefs,
  onChange,
  onSave,
  isLoading,
}: SettingsNotificacionesProps) {
  return (
    <GlassSection
      title="Notificaciones"
      description="Controla qué emails se envían automáticamente a clientes y al equipo."
    >
      {/* Client notifications */}
      <div className="space-y-1 mb-4">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold px-1 mb-2">
          Para clientes
        </p>

        <ToggleRow
          label="Confirmación de reserva"
          description="Email automático con todos los detalles cuando un cliente reserva una cita."
          icon={<MailCheck className="w-4 h-4" />}
          field="notif_booking_confirmed"
          value={prefs.notif_booking_confirmed}
          onChange={onChange}
          disabled={isLoading}
          badge="Recomendado"
        />

        <ToggleRow
          label="Confirmación de cancelación"
          description="Email cuando una cita es cancelada por el cliente o el equipo."
          icon={<MailX className="w-4 h-4" />}
          field="notif_booking_cancelled"
          value={prefs.notif_booking_cancelled}
          onChange={onChange}
          disabled={isLoading}
        />

        <ToggleRow
          label="Recordatorio 24 horas antes"
          description="Email de recordatorio enviado automáticamente el día anterior a la cita."
          icon={<Clock className="w-4 h-4" />}
          field="notif_reminder_24h"
          value={prefs.notif_reminder_24h}
          onChange={onChange}
          disabled={isLoading}
          badge="Reduce no-show"
        />

        <ToggleRow
          label="Recordatorio 1 hora antes"
          description="Email de recordatorio justo una hora antes. Útil junto al de 24h para máxima asistencia."
          icon={<AlarmClock className="w-4 h-4" />}
          field="notif_reminder_1h"
          value={prefs.notif_reminder_1h}
          onChange={onChange}
          disabled={isLoading}
        />
      </div>

      {/* Owner notifications */}
      <div className="space-y-1 pt-3 border-t border-white/10">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold px-1 mb-2">
          Para el negocio
        </p>

        <ToggleRow
          label="Nueva reserva"
          description="Recibe un email cada vez que un cliente reserve una cita desde el portal público."
          icon={<UserCheck className="w-4 h-4" />}
          field="notif_new_booking_owner"
          value={prefs.notif_new_booking_owner}
          onChange={onChange}
          disabled={isLoading}
        />
      </div>

      <div className="pt-4 flex justify-end border-t border-white/10 mt-3">
        <GlassButton onClick={onSave} isLoading={isLoading} className="h-10 px-5">
          Guardar Notificaciones
        </GlassButton>
      </div>
    </GlassSection>
  );
}
