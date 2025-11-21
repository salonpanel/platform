'use client';

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

type StripeStatus = {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_status: string;
  future_requirements: any;
  connected: boolean;
  account_id?: string;
};

export default function PagosPage() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/payments/stripe/status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar estado");
      }

      setStatus(data);
    } catch (err: any) {
      setError(err?.message || "Error al cargar estado de Stripe");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (connecting) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/stripe/connect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al conectar con Stripe");
      }

      // Redirigir a Stripe para onboarding
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err?.message || "Error al conectar con Stripe");
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Cargando estado de pagos...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de Pagos</h1>
          <p className="text-sm text-gray-600 mt-1">
            Conecta tu cuenta Stripe para recibir pagos directamente
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {status && (
        <div className="space-y-6">
          {/* Estado de conexión */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Estado de Stripe Connect</h2>
              {status.connected ? (
                <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded">
                  ✓ Conectado
                </span>
              ) : (
                <span className="text-xs text-gray-600 bg-gray-50 px-3 py-1 rounded">
                  No conectado
                </span>
              )}
            </div>

            {!status.connected ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Conecta tu cuenta Stripe para empezar a recibir pagos. El proceso
                  de onboarding solo toma unos minutos.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? "Conectando..." : "Conectar Stripe"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Pagos habilitados</p>
                    <p className="text-lg font-semibold">
                      {status.charges_enabled ? (
                        <span className="text-green-600">✓ Sí</span>
                      ) : (
                        <span className="text-red-600">✗ No</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payouts habilitados</p>
                    <p className="text-lg font-semibold">
                      {status.payouts_enabled ? (
                        <span className="text-green-600">✓ Sí</span>
                      ) : (
                        <span className="text-red-600">✗ No</span>
                      )}
                    </p>
                  </div>
                </div>

                {status.onboarding_status === "completed" && (
                  <div className="rounded border border-green-500 bg-green-50 p-3 text-sm text-green-700">
                    ✓ Tu cuenta Stripe está completamente configurada y lista para recibir pagos.
                  </div>
                )}

                {status.onboarding_status === "restricted" && (
                  <div className="rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-700">
                    ⚠ Tu cuenta Stripe necesita completar información adicional.{" "}
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="underline font-medium"
                    >
                      Completar onboarding
                    </button>
                  </div>
                )}

                {status.onboarding_status === "pending" && (
                  <div className="rounded border border-blue-500 bg-blue-50 p-3 text-sm text-blue-700">
                    ⏳ El onboarding está en proceso.{" "}
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="underline font-medium"
                    >
                      Continuar
                    </button>
                  </div>
                )}

                {status.future_requirements && status.future_requirements.length > 0 && (
                  <div className="rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-700">
                    <p className="font-medium mb-2">Requisitos pendientes:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {status.future_requirements.map((req: any, idx: number) => (
                        <li key={idx}>{req.reason || "Información adicional requerida"}</li>
                      ))}
                    </ul>
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="mt-2 underline font-medium"
                    >
                      Completar requisitos
                    </button>
                  </div>
                )}

                {status.account_id && (
                  <div className="text-xs text-gray-500 mt-2">
                    Account ID: {status.account_id}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Información adicional */}
          <div className="border rounded-lg p-6 bg-gray-50">
            <h3 className="text-sm font-medium mb-2">¿Cómo funciona?</h3>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Los clientes pagan directamente a tu cuenta Stripe</li>
              <li>El dinero se retiene 24-48 horas antes de estar disponible</li>
              <li>Los payouts se realizan según tu configuración en Stripe</li>
              <li>BookFast no maneja tu dinero, solo proporciona el software</li>
            </ul>
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            {status.connected && (
              <button
                onClick={() => router.push("/panel/monedero")}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Ver Monedero
              </button>
            )}
            <button
              onClick={loadStatus}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Actualizar Estado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



