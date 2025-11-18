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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <svg
              className="h-8 w-8 animate-spin"
              style={{ color: "rgb(148, 163, 184)" }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-70"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-slate-400">Cargando tenants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-4 rounded border border-red-500 bg-red-50 p-4 text-red-600">
          <h3 className="mb-2 font-semibold">Error al cargar tenants</h3>
          <p>{error}</p>
          <button
            onClick={loadTenants}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Reintentar
          </button>
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
            href="/admin/new-tenant"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            + Nueva Barbería
          </Link>
          <Link
            href="/admin/platform-users"
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Platform Users
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/50 overflow-hidden bg-slate-900/30">
        <table className="w-full">
          <thead className="bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Features Activos
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                KPIs
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Creado
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {tenants.map((tenant, index) => (
              <tr 
                key={tenant.id} 
                className={`transition-all duration-150 ${
                  index % 2 === 0 ? "bg-slate-800/20" : "bg-slate-800/10"
                } hover:bg-slate-700/30 hover:shadow-sm`}
              >
                <td className="px-4 py-3 text-sm text-slate-200 font-medium">{tenant.name}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-400">
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
                        <span className="text-gray-700">
                          {tenant.kpis.total_bookings.toLocaleString()} total
                        </span>
                        {tenant.kpis.bookings_today > 0 && (
                          <span className="ml-1 text-green-600">
                            ({tenant.kpis.bookings_today} hoy)
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">Servicios:</span>{" "}
                        <span className="text-gray-700">
                          {tenant.kpis.active_services} activos
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Staff:</span>{" "}
                        <span className="text-gray-700">
                          {tenant.kpis.active_staff} activo
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">Sin métricas</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={`/admin/${tenant.id}`}
                    className="text-slate-300 hover:text-slate-100 font-medium transition-colors"
                  >
                    Gestionar →
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

