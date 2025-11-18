'use client';

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Service } from "@/types/services";

export default function PaymentsConfigPage() {
  const supabase = createClientComponentClient();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // P1.3: Obtener tenant_id del usuario
      // Nota: Esto debería usar memberships en lugar de profiles
      const { data: membership } = await supabase
        .from("memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const tenant = membership?.tenant_id ?? null;
      if (mounted) {
        setTenantId(tenant);
      }

      if (!tenant) {
        setLoading(false);
        return;
      }

      // Cargar servicios del tenant
      const { data, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenant)
        .order("name");

      if (mounted) {
        if (servicesError) {
          setError(`Error al cargar servicios: ${servicesError.message}`);
        } else {
          setServices((data as Service[]) || []);
        }
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const syncService = async (serviceId: string) => {
    if (!tenantId || syncing[serviceId]) return;

    setSyncing({ ...syncing, [serviceId]: true });
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/payments/services/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          tenant_id: tenantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al sincronizar servicio");
      }

      // Actualizar servicio en la lista
      setServices((prev) =>
        prev.map((service) =>
          service.id === serviceId
            ? {
                ...service,
                stripe_product_id: data.product_id,
                stripe_price_id: data.price_id,
              }
            : service
        )
      );

      setSuccess(`Servicio "${data.service_id}" sincronizado correctamente`);
    } catch (err: any) {
      setError(err?.message || "Error al sincronizar servicio");
    } finally {
      setSyncing({ ...syncing, [serviceId]: false });
    }
  };

  const syncAll = async () => {
    if (!tenantId || syncingAll) return;

    setSyncingAll(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/payments/services/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al sincronizar servicios");
      }

      // Actualizar servicios sincronizados
      if (data.details) {
        const updatedServices = [...services];
        data.details.forEach((detail: any) => {
          if (detail.synced) {
            const index = updatedServices.findIndex(
              (s) => s.id === detail.service_id
            );
            if (index !== -1) {
              updatedServices[index] = {
                ...updatedServices[index],
                stripe_product_id: detail.product_id,
                stripe_price_id: detail.price_id,
              };
            }
          }
        });
        setServices(updatedServices);
      }

      setSuccess(
        `Sincronizados ${data.synced} servicios. ${data.failed} fallaron.`
      );
    } catch (err: any) {
      setError(err?.message || "Error al sincronizar servicios");
    } finally {
      setSyncingAll(false);
    }
  };

  const servicesWithoutPriceId = services.filter(
    (s) => s.active && (!s.stripe_price_id || s.stripe_price_id === "")
  );

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Cargando servicios...</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">
          No tienes un tenant asignado. Por favor, contacta con el administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Configuración de Pagos</h1>
        {servicesWithoutPriceId.length > 0 && (
          <button
            onClick={syncAll}
            disabled={syncingAll}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncingAll
              ? "Sincronizando..."
              : `Sincronizar todos (${servicesWithoutPriceId.length})`}
          </button>
        )}
      </div>

      {success && (
        <div className="rounded border border-green-500 bg-green-50 p-3 text-sm text-green-600">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium mb-2">Servicios</h2>
          <p className="text-sm text-gray-600 mb-4">
            Los servicios deben tener un precio configurado en Stripe para ser
            vendibles. Si un servicio no tiene precio, el checkout se bloqueará.
          </p>
        </div>

        <div className="border rounded divide-y">
          {services.map((service) => {
            const hasPriceId = service.stripe_price_id && service.stripe_price_id !== "";
            const isSyncing = syncing[service.id];

            return (
              <div
                key={service.id}
                className="p-4 flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{service.name}</span>
                    {!service.active && (
                      <span className="text-xs text-gray-500">(Inactivo)</span>
                    )}
                    {hasPriceId ? (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        ✓ Sincronizado
                      </span>
                    ) : service.active ? (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        ⚠ Sin precio
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {service.duration_min} min ·{' '}
                    {(service.price_cents / 100).toFixed(2)} €
                  </div>
                  {service.stripe_product_id && (
                    <div className="text-xs text-gray-500 mt-1">
                      Product ID: {service.stripe_product_id}
                    </div>
                  )}
                  {service.stripe_price_id && (
                    <div className="text-xs text-gray-500 mt-1">
                      Price ID: {service.stripe_price_id}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!hasPriceId && service.active && (
                    <button
                      onClick={() => syncService(service.id)}
                      disabled={isSyncing}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? "Sincronizando..." : "Sincronizar"}
                    </button>
                  )}
                  {hasPriceId && (
                    <button
                      onClick={() => syncService(service.id)}
                      disabled={isSyncing}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? "Actualizando..." : "Actualizar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {services.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              No hay servicios. Crea servicios primero en la página de servicios.
            </div>
          )}
        </div>

        {servicesWithoutPriceId.length > 0 && (
          <div className="rounded border border-amber-500 bg-amber-50 p-4">
            <h3 className="font-medium text-amber-800 mb-2">
              Servicios sin precio ({servicesWithoutPriceId.length})
            </h3>
            <p className="text-sm text-amber-700">
              Los siguientes servicios activos no tienen un precio configurado
              en Stripe y no se pueden vender:
            </p>
            <ul className="mt-2 space-y-1">
              {servicesWithoutPriceId.map((service) => (
                <li key={service.id} className="text-sm text-amber-700">
                  • {service.name}
                </li>
              ))}
            </ul>
            <button
              onClick={syncAll}
              disabled={syncingAll}
              className="mt-3 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {syncingAll
                ? "Sincronizando..."
                : "Sincronizar todos con Stripe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

