"use client";

import { useState, useEffect } from "react";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { Loader2 } from "lucide-react";

type ViewMode = "day" | "week" | "month" | "list";
type DisplayMode = "compact" | "comfortable";
type ColorScheme = "subtle" | "intense";

export default function CalendarSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    defaultView: "day" as ViewMode,
    displayMode: "comfortable" as DisplayMode,
    colorScheme: "subtle" as ColorScheme,
  });

  // Cargar preferencias desde localStorage
  useEffect(() => {
    const saved = localStorage.getItem("calendarSettings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading calendar settings:", e);
      }
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("calendarSettings", JSON.stringify(settings));
    setTimeout(() => {
      setSaving(false);
      alert("Configuración guardada");
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Configuración del calendario
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Personaliza cómo se muestra tu agenda
        </p>
      </div>

      {/* Vista predeterminada */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Vista predeterminada
        </h2>
        <div className="space-y-2">
          {[
            { value: "day", label: "Día" },
            { value: "week", label: "Semana" },
            { value: "month", label: "Mes" },
            { value: "list", label: "Lista" },
          ].map((view) => (
            <label
              key={view.value}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <input
                type="radio"
                name="defaultView"
                value={view.value}
                checked={settings.defaultView === view.value}
                onChange={(e) =>
                  setSettings({ ...settings, defaultView: e.target.value as ViewMode })
                }
                className="text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span className="text-[var(--text-primary)]">{view.label}</span>
            </label>
          ))}
        </div>
      </GlassCard>

      {/* Modo de visualización */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Modo de visualización
        </h2>
        <div className="space-y-2">
          {[
            { value: "compact", label: "Compacto", desc: "Más líneas, menos espacio" },
            { value: "comfortable", label: "Cómodo", desc: "Más padding, cards más grandes" },
          ].map((mode) => (
            <label
              key={mode.value}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <input
                type="radio"
                name="displayMode"
                value={mode.value}
                checked={settings.displayMode === mode.value}
                onChange={(e) =>
                  setSettings({ ...settings, displayMode: e.target.value as DisplayMode })
                }
                className="text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <div>
                <div className="text-[var(--text-primary)] font-medium">{mode.label}</div>
                <div className="text-xs text-[var(--text-secondary)]">{mode.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </GlassCard>

      {/* Esquema de colores */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Esquema de colores
        </h2>
        <div className="space-y-2">
          {[
            { value: "subtle", label: "Discreto", desc: "Colores suaves" },
            { value: "intense", label: "Intenso", desc: "Colores más saturados por estado" },
          ].map((scheme) => (
            <label
              key={scheme.value}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              <input
                type="radio"
                name="colorScheme"
                value={scheme.value}
                checked={settings.colorScheme === scheme.value}
                onChange={(e) =>
                  setSettings({ ...settings, colorScheme: e.target.value as ColorScheme })
                }
                className="text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <div>
                <div className="text-[var(--text-primary)] font-medium">{scheme.label}</div>
                <div className="text-xs text-[var(--text-secondary)]">{scheme.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </GlassCard>

      {/* Horarios y turnos */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Horarios y turnos
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Configura los horarios de trabajo y disponibilidad del personal
        </p>
        <GlassButton
          variant="secondary"
          onClick={() => {
            // TODO: Navegar a página de staff/horarios
            alert("Funcionalidad en desarrollo");
          }}
        >
          Configurar horarios
        </GlassButton>
      </GlassCard>

      {/* Importar calendario */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Importar calendario
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Importa eventos desde un archivo .ics (iCalendar)
        </p>
        <GlassButton
          variant="secondary"
          disabled
          className="opacity-50 cursor-not-allowed"
        >
          Próximamente
        </GlassButton>
      </GlassCard>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <GlassButton onClick={handleSave} disabled={saving} isLoading={saving}>
          Guardar configuración
        </GlassButton>
      </div>
    </div>
  );
}








