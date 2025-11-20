"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

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
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Configuración del calendario
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Personaliza cómo se muestra tu agenda
        </p>
      </div>

      {/* Vista predeterminada */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
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
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <input
                type="radio"
                name="defaultView"
                value={view.value}
                checked={settings.defaultView === view.value}
                onChange={(e) =>
                  setSettings({ ...settings, defaultView: e.target.value as ViewMode })
                }
                className="text-[var(--color-accent)]"
              />
              <span className="text-[var(--color-text-primary)]">{view.label}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Modo de visualización */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Modo de visualización
        </h2>
        <div className="space-y-2">
          {[
            { value: "compact", label: "Compacto", desc: "Más líneas, menos espacio" },
            { value: "comfortable", label: "Cómodo", desc: "Más padding, cards más grandes" },
          ].map((mode) => (
            <label
              key={mode.value}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <input
                type="radio"
                name="displayMode"
                value={mode.value}
                checked={settings.displayMode === mode.value}
                onChange={(e) =>
                  setSettings({ ...settings, displayMode: e.target.value as DisplayMode })
                }
                className="text-[var(--color-accent)]"
              />
              <div>
                <div className="text-[var(--color-text-primary)] font-medium">{mode.label}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{mode.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Esquema de colores */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Esquema de colores
        </h2>
        <div className="space-y-2">
          {[
            { value: "subtle", label: "Discreto", desc: "Colores suaves" },
            { value: "intense", label: "Intenso", desc: "Colores más saturados por estado" },
          ].map((scheme) => (
            <label
              key={scheme.value}
              className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <input
                type="radio"
                name="colorScheme"
                value={scheme.value}
                checked={settings.colorScheme === scheme.value}
                onChange={(e) =>
                  setSettings({ ...settings, colorScheme: e.target.value as ColorScheme })
                }
                className="text-[var(--color-accent)]"
              />
              <div>
                <div className="text-[var(--color-text-primary)] font-medium">{scheme.label}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{scheme.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Horarios y turnos */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Horarios y turnos
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Configura los horarios de trabajo y disponibilidad del personal
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            // TODO: Navegar a página de staff/horarios
            alert("Funcionalidad en desarrollo");
          }}
        >
          Configurar horarios
        </Button>
      </Card>

      {/* Importar calendario */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Importar calendario
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Importa eventos desde un archivo .ics (iCalendar)
        </p>
        <Button
          variant="secondary"
          disabled
          className="opacity-50 cursor-not-allowed"
        >
          Próximamente
        </Button>
      </Card>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} isLoading={saving}>
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}








