"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type Plan = {
  id: string;
  key: string;
  name: string;
  description: string;
  price_monthly_cents: number;
};

type Feature = {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
};

type OrgPlan = {
  plan_id: string;
  billing_state: string;
};

type OrgFeatureOverride = {
  id: string;
  feature_key: string;
  enabled: boolean;
  expires_at: string | null;
};

type DailyMetric = {
  id: string;
  metric_date: string;
  total_bookings: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  no_show_bookings: number;
  revenue_cents: number;
  occupancy_rate: number;
  active_services: number;
  active_staff: number;
};

export default function AdminTenantPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const supabase = getSupabaseBrowser();

  const [tenant, setTenant] = useState<any>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [orgPlan, setOrgPlan] = useState<OrgPlan | null>(null);
  const [overrides, setOverrides] = useState<OrgFeatureOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid"); // P1.2: Timezone del tenant
  const [timezoneInput, setTimezoneInput] = useState<string>("Europe/Madrid"); // P1.2: Input de timezone
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar tenant
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", orgId)
        .single();
      setTenant(tenantData);
      
      // P1.2: Cargar timezone del tenant
      if (tenantData?.timezone) {
        setTenantTimezone(tenantData.timezone);
        setTimezoneInput(tenantData.timezone);
      }

      // Cargar métricas (últimos 30 días)
      loadMetrics();

      // Cargar planes (usar endpoint server-side)
      const plansResponse = await fetch("/api/admin/plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData || []);
      }

      // Cargar features (usar endpoint server-side)
      const featuresResponse = await fetch("/api/admin/features");
      if (featuresResponse.ok) {
        const featuresData = await featuresResponse.json();
        setFeatures(featuresData || []);
      }

      // Cargar plan de la org (usar endpoint server-side)
      const orgPlanResponse = await fetch(`/api/admin/tenants/${orgId}/plan`);
      if (orgPlanResponse.ok) {
        const orgPlanData = await orgPlanResponse.json();
        setOrgPlan(orgPlanData);
      }

      // Cargar overrides (usar endpoint server-side)
      const overridesResponse = await fetch(`/api/admin/tenants/${orgId}/features`);
      if (overridesResponse.ok) {
        const overridesData = await overridesResponse.json();
        setOverrides(overridesData || []);
      }
    } catch (err: any) {
      setError(err?.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const changePlan = async (planId: string) => {
    try {
      setSaving(true);
      setError(null);

      // Usar endpoint server-side
      const response = await fetch(`/api/admin/tenants/${orgId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: planId,
          billing_state: "active",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cambiar plan");
      }

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error al cambiar plan");
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = async (featureKey: string, enabled: boolean) => {
    try {
      setSaving(true);
      setError(null);

      // Usar endpoint server-side
      const response = await fetch(`/api/admin/tenants/${orgId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_key: featureKey,
          enabled,
          reason: "Manual override desde admin",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cambiar feature");
      }

      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error al cambiar feature");
    } finally {
      setSaving(false);
    }
  };

  const startImpersonation = async () => {
    if (!impersonateReason.trim()) {
      setError("Debes proporcionar un motivo para la impersonación");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Usar endpoint server-side
      const response = await fetch(`/api/admin/tenants/${orgId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: impersonateReason.trim(),
          expires_in_hours: 8, // Default: 8 horas
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al iniciar impersonación");
      }

      // Redirigir al panel de la org
      if (data.redirect_url) {
        router.push(data.redirect_url);
      } else {
        router.push(`/panel?impersonate=${orgId}`);
      }
    } catch (err: any) {
      setError(err?.message || "Error al iniciar impersonación");
    } finally {
      setSaving(false);
      setShowImpersonateModal(false);
      setImpersonateReason("");
    }
  };

  // P1.2: Función para actualizar timezone del tenant
  const updateTimezone = async () => {
    try {
      setSaving(true);
      setError(null);

      // Usar endpoint server-side
      const response = await fetch(`/api/admin/tenants/${orgId}/timezone`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: timezoneInput.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar timezone");
      }

      // Actualizar timezone local
      setTenantTimezone(timezoneInput.trim());
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Error al actualizar timezone");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Cargando información del tenant...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <div className="mb-4 rounded border border-red-500 bg-red-50 p-4 text-red-600">
          <h3 className="mb-2 font-semibold">Tenant no encontrado</h3>
          <p>El tenant solicitado no existe o no tienes permisos para acceder.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Volver a lista
          </Link>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === orgPlan?.plan_id);
  const overrideMap = new Map(
    overrides.map((o) => [o.feature_key, o.enabled])
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-blue-600 hover:underline">
            ← Volver a lista
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{tenant.name}</h1>
          <p className="text-sm text-gray-600">Slug: {tenant.slug}</p>
        </div>
        <button
          onClick={() => setShowImpersonateModal(true)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Impersonar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-500 bg-red-50 p-4 text-red-600">
          <h3 className="mb-2 font-semibold">Error</h3>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadData();
            }}
            className="mt-2 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Cambio de Plan */}
      <section className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Plan Actual</h2>
        {currentPlan ? (
          <div className="mb-4">
            <p className="font-medium">{currentPlan.name}</p>
            <p className="text-sm text-gray-600">{currentPlan.description}</p>
            <p className="text-sm text-gray-600">
              {(currentPlan.price_monthly_cents / 100).toFixed(2)} €/mes
            </p>
          </div>
        ) : (
          <p className="text-gray-500">Sin plan asignado</p>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium">Cambiar a:</label>
          <select
            className="w-full rounded border p-2 disabled:opacity-50 disabled:cursor-not-allowed"
            value={orgPlan?.plan_id || ""}
            onChange={(e) => changePlan(e.target.value)}
            disabled={saving}
          >
            <option value="">Selecciona un plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} - {(plan.price_monthly_cents / 100).toFixed(2)} €/mes
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* P1.2: Timezone */}
      <section className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Timezone</h2>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Timezone del tenant:</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded border p-2"
              value={timezoneInput}
              onChange={(e) => setTimezoneInput(e.target.value)}
              placeholder="Europe/Madrid"
              disabled={saving}
            />
            <button
              onClick={updateTimezone}
              disabled={saving || timezoneInput.trim() === tenantTimezone}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Guardando...
                </span>
              ) : (
                "Actualizar"
              )}
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Timezone actual: <span className="font-mono">{tenantTimezone}</span>
          </p>
          <p className="text-xs text-gray-500">
            Ejemplos: Europe/Madrid, America/New_York, America/Los_Angeles, UTC
          </p>
        </div>
      </section>

      {/* Métricas Diarias */}
      <section className="rounded border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Métricas Diarias</h2>
          <button
            onClick={loadMetrics}
            disabled={metricsLoading}
            className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 disabled:opacity-50"
          >
            {metricsLoading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
        {metricsLoading && metrics.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <p className="text-sm text-gray-500">Cargando métricas...</p>
            </div>
          </div>
        ) : metrics.length === 0 ? (
          <p className="text-gray-500">
            No hay métricas disponibles. Las métricas se calculan automáticamente cada día a las 2:00 AM UTC.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Resumen de últimos 7 días */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(() => {
                const last7Days = metrics.slice(0, 7);
                const totalBookings = last7Days.reduce((sum, m) => sum + m.total_bookings, 0);
                const totalRevenue = last7Days.reduce((sum, m) => sum + m.revenue_cents, 0);
                const avgOccupancy =
                  last7Days.length > 0
                    ? last7Days.reduce((sum, m) => sum + Number(m.occupancy_rate || 0), 0) /
                      last7Days.length
                    : 0;

                return (
                  <>
                    <div className="rounded border bg-blue-50 p-3">
                      <div className="text-xs text-gray-600">Reservas (7d)</div>
                      <div className="text-xl font-semibold">{totalBookings}</div>
                    </div>
                    <div className="rounded border bg-green-50 p-3">
                      <div className="text-xs text-gray-600">Ingresos (7d)</div>
                      <div className="text-xl font-semibold">
                        {(totalRevenue / 100).toFixed(2)} €
                      </div>
                    </div>
                    <div className="rounded border bg-purple-50 p-3">
                      <div className="text-xs text-gray-600">Ocupación (7d)</div>
                      <div className="text-xl font-semibold">{avgOccupancy.toFixed(1)}%</div>
                    </div>
                    <div className="rounded border bg-orange-50 p-3">
                      <div className="text-xs text-gray-600">Servicios Activos</div>
                      <div className="text-xl font-semibold">
                        {metrics[0]?.active_services || 0}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Tabla de métricas */}
            <div className="overflow-x-auto rounded-lg border border-slate-700/50 overflow-hidden bg-slate-900/30">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Reservas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Confirmadas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Canceladas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">No Show</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Ingresos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">Ocupación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {metrics.slice(0, 14).map((metric, index) => (
                    <tr 
                      key={metric.id} 
                      className={`transition-all duration-150 ${
                        index % 2 === 0 ? "bg-slate-800/20" : "bg-slate-800/10"
                      } hover:bg-slate-700/30 hover:shadow-sm`}
                    >
                      <td className="px-4 py-3 text-slate-200">
                        {new Date(metric.metric_date).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">{metric.total_bookings}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">
                        {metric.confirmed_bookings}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-400">
                        {metric.cancelled_bookings}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-400">
                        {metric.no_show_bookings}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-200">
                        {(metric.revenue_cents / 100).toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {Number(metric.occupancy_rate || 0).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {metrics.length > 14 && (
              <p className="text-xs text-gray-500">
                Mostrando últimos 14 días de {metrics.length} días disponibles
              </p>
            )}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Features</h2>
        <div className="space-y-3">
          {features.map((feature) => {
            const isOverridden = overrideMap.has(feature.key);
            const isEnabled = isOverridden
              ? overrideMap.get(feature.key)
              : currentPlan
              ? // Verificar si el plan incluye este feature
                true // Simplificado: en producción verificarías plan_features
              : false;

            return (
              <div
                key={feature.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <div className="flex-1">
                  <div className="font-medium">{feature.name}</div>
                  <div className="text-sm text-gray-600">{feature.description}</div>
                  {isOverridden && (
                    <div className="mt-1 text-xs text-blue-600">
                      Override activo
                    </div>
                  )}
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => toggleFeature(feature.key, e.target.checked)}
                    disabled={saving}
                    className="peer sr-only disabled:cursor-not-allowed"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal de Impersonación */}
      {showImpersonateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Impersonar Organización</h3>
            <p className="mb-4 text-sm text-gray-600">
              Proporciona un motivo para esta impersonación. Quedará registrado
              en los logs de auditoría.
            </p>
            <textarea
              className="mb-4 w-full rounded border p-2"
              rows={3}
              placeholder="Motivo de la impersonación..."
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowImpersonateModal(false);
                  setImpersonateReason("");
                }}
                className="flex-1 rounded border px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={startImpersonation}
                disabled={saving || !impersonateReason.trim()}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Iniciando...
                  </span>
                ) : (
                  "Impersonar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

