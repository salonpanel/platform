"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  plan?: {
    key: string;
    name: string;
    billing_state: string;
  };
  active_features?: string[];
  kpis?: {
    total_bookings: number;
    bookings_today: number;
    active_services: number;
    active_staff: number;
  };
};

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/tenants");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar tenants");
      }

      setTenants(data);
    } catch (err: any) {
      setError(err?.message || "Error al cargar tenants");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Cargando tenants...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administración de Plataforma</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/platform-users"
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Platform Users
          </Link>
        </div>
      </div>

      <div className="rounded border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Slug</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Plan</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Features Activos
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                KPIs
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Creado
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{tenant.name}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">
                  {tenant.slug}
                </td>
                <td className="px-4 py-3 text-sm">
                  {tenant.plan ? (
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs ${
                        tenant.plan.billing_state === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {tenant.plan.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">Sin plan</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {tenant.active_features?.map((key) => (
                      <span
                        key={key}
                        className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                      >
                        {key}
                      </span>
                    ))}
                    {(!tenant.active_features ||
                      tenant.active_features.length === 0) && (
                      <span className="text-gray-400 text-xs">Ninguna</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {tenant.kpis ? (
                    <div className="flex flex-col gap-1 text-xs">
                      <div>
                        <span className="font-medium">Reservas:</span>{" "}
                        {tenant.kpis.total_bookings} total, {tenant.kpis.bookings_today} hoy
                      </div>
                      <div>
                        <span className="font-medium">Servicios:</span>{" "}
                        {tenant.kpis.active_services} activos
                      </div>
                      <div>
                        <span className="font-medium">Staff:</span>{" "}
                        {tenant.kpis.active_staff} activo
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">Cargando...</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={`/admin/${tenant.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Gestionar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No hay tenants registrados.
          </div>
        )}
      </div>
    </div>
  );
}

