"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
import { GlassCard, GlassButton, GlassToast } from "@/components/ui/glass";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function NoShowContent() {
  const supabase = getSupabaseBrowser();
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"deposit" | "cancellation">("deposit");
  const [percentage, setPercentage] = useState(10);
  const [cancellationHours, setCancellationHours] = useState(12);

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const { tenant } = await getCurrentTenant(impersonateOrgId);

        if (tenant) {
          setTenantId(tenant.id);

          // Cargar configuración de no-show desde tenant_settings
          const { data: settings, error: settingsError } = await supabase
            .from("tenant_settings")
            .select("*")
            .eq("tenant_id", tenant.id)
            .maybeSingle();

          if (settingsError && settingsError.code !== "PGRST116") {
            console.error("Error al cargar settings:", settingsError);
          }

          if (settings) {
            setEnabled(settings.no_show_protection_enabled || false);
            setMode(settings.no_show_protection_mode || "deposit");
            setPercentage(settings.no_show_protection_percentage || 10);
            setCancellationHours(settings.no_show_cancellation_hours || 12);
          } else {
            // Valores por defecto si no existe configuración
            setEnabled(false);
            setMode("deposit");
            setPercentage(10);
            setCancellationHours(12);
          }
        } else {
          setError("No tienes acceso a ninguna barbería");
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar configuración");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [impersonateOrgId]);

  const handleSave = async () => {
    if (!tenantId || saving) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      // Guardar en tenant_settings (upsert)
      const { error: upsertError } = await supabase
        .from("tenant_settings")
        .upsert({
          tenant_id: tenantId,
          no_show_protection_enabled: enabled,
          no_show_protection_mode: mode,
          no_show_protection_percentage: percentage,
          no_show_cancellation_hours: cancellationHours,
        }, {
          onConflict: "tenant_id",
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      setSuccess("Protección contra ausencias actualizada correctamente");
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err?.message || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const policyText = useMemo(() => {
    if (!enabled) return "";
    if (mode === "deposit") {
      return `El cliente paga el ${percentage}% al reservar. Si cancela con menos de ${cancellationHours}h de antelación o no se presenta, se retiene el depósito.`;
    } else {
      return `Si el cliente cancela con menos de ${cancellationHours}h de antelación o no se presenta, se aplica una tarifa de cancelación del ${percentage}% del precio del servicio.`;
    }
  }, [enabled, mode, percentage, cancellationHours]);

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
        <h1 className="text-2xl font-semibold text-white">Protección contra ausencias</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Configura depósitos o tarifas de cancelación para reducir no-shows
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <GlassCard className="border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </GlassCard>
      )}

      {success && (
        <GlassCard className="border-emerald-500/50 bg-emerald-500/10 p-4">
          <p className="text-sm text-emerald-300">{success}</p>
        </GlassCard>
      )}

      {/* Card principal */}
      <GlassCard className="p-6">
        <div className="space-y-6">
          {/* Toggle principal */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Activar protección contra ausencias
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Reduce las ausencias y cancelaciones de última hora
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-accent)]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
            </label>
          </div>

          {enabled && (
            <>
              {/* Selector de modo */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  Modo de protección
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("deposit")}
                    className={`
                      flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all
                      ${mode === "deposit"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "border-white/10 bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
                      }
                    `}
                  >
                    Depósito
                  </button>
                  <button
                    onClick={() => setMode("cancellation")}
                    className={`
                      flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all
                      ${mode === "cancellation"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "border-white/10 bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
                      }
                    `}
                  >
                    Tarifa de cancelación
                  </button>
                </div>
              </div>

              {/* Control de porcentaje */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  {mode === "deposit" ? "Porcentaje del depósito" : "Porcentaje de la tarifa"}
                </label>
                <div className="flex items-center gap-4">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setPercentage(Math.max(0, percentage - 5))}
                    disabled={percentage <= 0}
                    className="h-12 w-12 text-xl font-semibold p-0 flex items-center justify-center"
                  >
                    −
                  </GlassButton>
                  <div className="flex-1 text-center">
                    <div className="text-4xl font-bold text-white">{percentage}%</div>
                    <div className="text-sm text-[var(--text-secondary)] mt-1">
                      {mode === "deposit"
                        ? "del precio del servicio por adelantado"
                        : "del precio del servicio"}
                    </div>
                  </div>
                  <GlassButton
                    variant="secondary"
                    onClick={() => setPercentage(Math.min(100, percentage + 5))}
                    disabled={percentage >= 100}
                    className="h-12 w-12 text-xl font-semibold p-0 flex items-center justify-center"
                  >
                    +
                  </GlassButton>
                </div>
              </div>

              {/* Horas de cancelación */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  Horas de antelación mínimas
                </label>
                <div className="flex items-center gap-4">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setCancellationHours(Math.max(1, cancellationHours - 1))}
                    disabled={cancellationHours <= 1}
                    className="h-10 w-10 text-lg font-semibold p-0 flex items-center justify-center"
                  >
                    −
                  </GlassButton>
                  <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-white">{cancellationHours}h</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Antes de la cita para evitar penalización
                    </div>
                  </div>
                  <GlassButton
                    variant="secondary"
                    onClick={() => setCancellationHours(Math.min(48, cancellationHours + 1))}
                    disabled={cancellationHours >= 48}
                    className="h-10 w-10 text-lg font-semibold p-0 flex items-center justify-center"
                  >
                    +
                  </GlassButton>
                </div>
              </div>

              {/* Resumen de política */}
              {policyText && (
                <GlassCard className="border-blue-500/30 bg-blue-500/10">
                  <div className="p-4">
                    <p className="text-sm text-blue-300">{policyText}</p>
                  </div>
                </GlassCard>
              )}

              {/* Botón guardar */}
              <div className="flex justify-end">
                <GlassButton onClick={handleSave} disabled={saving} isLoading={saving}>
                  Guardar configuración
                </GlassButton>
              </div>
            </>
          )}
        </div>
      </GlassCard>

      {/* Toast de confirmación */}
      {showToast && success && (
        <GlassToast
          message={success}
          tone="success"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

export default function NoShowPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
        </div>
      }
    >
      <NoShowContent />
    </Suspense>
  );
}

