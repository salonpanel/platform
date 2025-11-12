"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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

export default function AdminTenantPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const supabase = createClientComponentClient();

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
      <div className="p-6">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
          Tenant no encontrado
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
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
          {error}
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
            className="w-full rounded border p-2"
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
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Actualizar"}
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
                    className="peer sr-only"
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
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? "Iniciando..." : "Impersonar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

