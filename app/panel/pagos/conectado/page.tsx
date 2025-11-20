'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PagosConectadoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/payments/stripe/status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al verificar estado");
      }

      setStatus(data);
    } catch (err: any) {
      setError(err?.message || "Error al verificar estado");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Verificando estado del onboarding...</p>
      </div>
    );
  }

  const isCompleted = status?.onboarding_status === "completed" && 
                      status?.charges_enabled && 
                      status?.payouts_enabled;

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="rounded border border-red-500 bg-red-50 p-4 text-sm text-red-600 mb-6">
            {error}
          </div>
        )}

        {isCompleted ? (
          <div className="space-y-4">
            <div className="rounded border border-green-500 bg-green-50 p-6 text-center">
              <div className="text-4xl mb-4">✓</div>
              <h1 className="text-2xl font-semibold text-green-800 mb-2">
                ¡Onboarding Completado!
              </h1>
              <p className="text-green-700">
                Tu cuenta Stripe está configurada y lista para recibir pagos.
              </p>
            </div>

            <div className="border rounded-lg p-6 space-y-3">
              <h2 className="font-medium">Estado de tu cuenta:</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Pagos habilitados</p>
                  <p className="text-lg font-semibold text-green-600">✓ Sí</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payouts habilitados</p>
                  <p className="text-lg font-semibold text-green-600">✓ Sí</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/panel/pagos")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Volver a Configuración
              </button>
              <button
                onClick={() => router.push("/panel/monedero")}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Ver Monedero
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded border border-amber-500 bg-amber-50 p-6 text-center">
              <div className="text-4xl mb-4">⏳</div>
              <h1 className="text-2xl font-semibold text-amber-800 mb-2">
                Onboarding en Proceso
              </h1>
              <p className="text-amber-700">
                {status?.onboarding_status === "restricted"
                  ? "Tu cuenta necesita completar información adicional."
                  : "Estamos verificando tu información. Esto puede tardar unos minutos."}
              </p>
            </div>

            {status?.future_requirements && status.future_requirements.length > 0 && (
              <div className="border rounded-lg p-6">
                <h3 className="font-medium mb-3">Requisitos pendientes:</h3>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                  {status.future_requirements.map((req: any, idx: number) => (
                    <li key={idx}>{req.reason || "Información adicional requerida"}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/panel/pagos")}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Continuar Onboarding
              </button>
              <button
                onClick={checkStatus}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Verificar Estado
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

