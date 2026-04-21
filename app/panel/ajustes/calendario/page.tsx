"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { GlassToast } from "@/components/ui/glass";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { usePermissions } from "@/contexts/PermissionsContext";

type ViewMode = "day" | "week" | "month" | "list";
type DisplayMode = "compact" | "comfortable";
type ColorScheme = "subtle" | "intense";

export default function CalendarSettingsPage() {
  const supabase = getSupabaseBrowser();
  const { tenantId, role, loading: permissionsLoading } = usePermissions();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" } | null>(null);
  const [settings, setSettings] = useState({
    defaultView: "day" as ViewMode,
    displayMode: "comfortable" as DisplayMode,
    colorScheme: "subtle" as ColorScheme,
  });

  // Cargar preferencias desde Supabase (fallback: localStorage)
  useEffect(() => {
    if (permissionsLoading) return;
    if (!tenantId) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("tenant_settings")
          .select("calendar_settings")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw new Error(error.message);

        const fromDb = (data as any)?.calendar_settings;
        if (fromDb && typeof fromDb === "object") {
          setSettings((prev) => ({
            ...prev,
            ...(fromDb as Partial<typeof prev>),
          }));
          return;
        }

        // Fallback: localStorage (y se migrará a DB en el próximo save)
        const saved = localStorage.getItem("calendarSettings");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === "object") {
              setSettings((prev) => ({ ...prev, ...(parsed as Partial<typeof prev>) }));
            }
          } catch (e) {
            console.error("Error loading calendar settings from localStorage:", e);
          }
        }
      } catch (e: any) {
        setToast({ message: e?.message || "Error al cargar preferencias del calendario", tone: "danger" });
        setTimeout(() => setToast(null), 3000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permissionsLoading, tenantId, supabase]);

  const handleSave = async () => {
    if (saving) return;
    if (!tenantId) {
      setToast({ message: "No se pudo identificar el negocio", tone: "danger" });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    setSaving(true);
    try {
      // Mantener fallback local por rapidez/soporte offline básico
      localStorage.setItem("calendarSettings", JSON.stringify(settings));

      // Persistir en Supabase (multi-dispositivo)
      const { data: updated, error } = await supabase
        .from("tenant_settings")
        .upsert(
          {
            tenant_id: tenantId,
            calendar_settings: settings,
          },
          { onConflict: "tenant_id" }
        )
        .select("tenant_id")
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!updated) {
        throw new Error("No tienes permisos para guardar esta configuración (se requiere owner/admin).");
      }

      setToast({ message: "Configuración guardada", tone: "success" });
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      setToast({ message: e?.message || "Error al guardar preferencias del calendario", tone: "danger" });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute requiredPermission="ajustes">
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
        <Link href="/panel/staff" className="inline-block">
          <GlassButton variant="secondary">
            Configurar horarios
          </GlassButton>
        </Link>
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
          <GlassButton
            onClick={handleSave}
            disabled={saving || permissionsLoading || role === "staff" || role === "viewer"}
            isLoading={saving}
            title={role === "staff" || role === "viewer" ? "Solo owner/admin pueden modificar esta configuración" : undefined}
          >
            Guardar configuración
          </GlassButton>
        </div>

        {toast && (
          <GlassToast
            message={toast.message}
            tone={toast.tone}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}








