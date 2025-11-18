"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";

function AjustesContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<{ id: string; name: string; timezone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    timezone: "Europe/Madrid",
  });

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        setLoading(true);
        const { tenant: tenantData } = await getCurrentTenant(impersonateOrgId);
        
        if (tenantData) {
          setTenant(tenantData);
          setForm({
            name: tenantData.name,
            timezone: tenantData.timezone || "Europe/Madrid",
          });
        } else {
          setError("No tienes acceso a ninguna barbería");
        }
      } catch (err: any) {
        setError(err?.message || "Error al cargar información");
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, [impersonateOrgId]);

  const updateTenant = async () => {
    if (!tenant || saving) return;

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("tenants")
        .update({
          name: form.name.trim(),
          timezone: form.timezone.trim(),
        })
        .eq("id", tenant.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setTenant({ ...tenant, name: form.name.trim(), timezone: form.timezone.trim() });
      setSuccess("Configuración actualizada correctamente");
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al actualizar configuración");
    } finally {
      setSaving(false);
    }
  };

  const timezones = [
    { value: "Europe/Madrid", label: "Madrid (GMT+1/+2)" },
    { value: "Europe/London", label: "Londres (GMT+0/+1)" },
    { value: "America/New_York", label: "Nueva York (EST/EDT)" },
    { value: "America/Los_Angeles", label: "Los Ángeles (PST/PDT)" },
    { value: "America/Mexico_City", label: "Ciudad de México (CST/CDT)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
    { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
    { value: "UTC", label: "UTC" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
        <h3 className="mb-2 font-semibold">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-sm text-gray-600">Configuración general de tu barbería</p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded border border-green-500 bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      {/* Configuración General */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Información General</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nombre de la Barbería <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              placeholder="Nombre de tu barbería"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Zona Horaria <span className="text-red-500">*</span>
            </label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              La zona horaria afecta a cómo se muestran las fechas y horas en toda la aplicación.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={updateTenant}
              disabled={saving || !form.name.trim() || !form.timezone.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>

      {/* Información del Tenant */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Información del Sistema</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">ID del Tenant:</span>
            <span className="font-mono text-gray-900">{tenant?.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Timezone Actual:</span>
            <span className="font-mono text-gray-900">{tenant?.timezone || "No configurado"}</span>
          </div>
        </div>
      </div>

      {/* Sección de ayuda */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h2 className="mb-2 text-lg font-semibold text-blue-900">💡 Ayuda</h2>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Timezone:</strong> Selecciona la zona horaria donde se encuentra tu barbería.
            Todas las reservas y horarios se mostrarán según esta configuración.
          </p>
          <p>
            <strong>Nombre:</strong> Este es el nombre que verán tus clientes y que aparecerá en
            las notificaciones y confirmaciones.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      }
    >
      <AjustesContent />
    </Suspense>
  );
}






