"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type WizardStep = 1 | 2 | 3 | 4;

const TIMEZONES = [
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Buenos_Aires",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "UTC",
];

export default function NewTenantPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Paso 1: Datos generales
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Europe/Madrid");

  // Paso 2: Usuario owner
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");

  // Paso 3: Plan (opcional)
  const [planKey, setPlanKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);

  // Generar slug automático desde nombre
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      // Validar paso 1
      if (!name.trim() || !slug.trim() || !timezone) {
        setError("Por favor, completa todos los campos");
        return;
      }
      
      // Validar slug usando la función centralizada
      const { isValidTenantSlug, isReservedSubdomain } = await import("@/lib/domains");
      const trimmedSlug = slug.trim().toLowerCase();
      
      if (!isValidTenantSlug(trimmedSlug)) {
        if (isReservedSubdomain(trimmedSlug)) {
          setError("Este nombre no está disponible, prueba con otra variante");
        } else {
          setError("El slug debe tener entre 3 y 32 caracteres, solo letras minúsculas, números y guiones, y no puede empezar ni terminar en guion");
        }
        return;
      }
      
      setError(null);
      setStep(2);
    } else if (step === 2) {
      // Validar paso 2
      if (!ownerEmail.trim()) {
        setError("El email del owner es requerido");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        setError("Email inválido");
        return;
      }
      setError(null);
      // Cargar planes
      try {
        const plansResponse = await fetch("/api/admin/plans");
        if (plansResponse.ok) {
          const plansData = await plansResponse.json();
          setPlans(plansData || []);
        }
      } catch (e) {
        console.warn("No se pudieron cargar planes:", e);
      }
      setStep(3);
    } else if (step === 3) {
      // Paso 3 es opcional, continuar
      setStep(4);
    } else if (step === 4) {
      // Crear tenant
      await handleCreate();
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          timezone,
          owner_email: ownerEmail.trim(),
          owner_name: ownerName.trim() || null,
          plan_key: planKey || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear tenant");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/admin/${data.tenant.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-green-500 bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-4xl">✅</div>
          <h1 className="mb-2 text-2xl font-semibold text-gray-900">
            Tenant creado exitosamente
          </h1>
          <p className="text-gray-600">Redirigiendo al panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← Volver a administración
          </Link>
        </div>

        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-2xl font-semibold text-gray-900">
            Crear Nueva Barbería
          </h1>

          {/* Indicador de pasos */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      step >= s
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    {step > s ? "✓" : s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`h-1 w-16 ${
                        step > s ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-600">
              <span>Datos</span>
              <span>Owner</span>
              <span>Plan</span>
              <span>Confirmar</span>
            </div>
          </div>

          {/* Contenido del paso */}
          <div className="mb-6">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Datos Generales
                </h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nombre de la barbería *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Ej: Barbería El Corte"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Slug (URL) *
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="barberia-el-corte"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    URL única para la barbería. Solo letras minúsculas, números y guiones.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Zona Horaria *
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Usuario Owner
                </h2>
                <p className="text-sm text-gray-600">
                  El usuario owner será el administrador principal de esta barbería.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Email del owner *
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="owner@barberia.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nombre del owner (opcional)
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Juan Pérez"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Plan y Features
                </h2>
                <p className="text-sm text-gray-600">
                  Selecciona un plan para la barbería (opcional, se puede asignar después).
                </p>
                {plans.length > 0 ? (
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={planKey === null}
                        onChange={() => setPlanKey(null)}
                        className="mr-2"
                      />
                      <span>Sin plan (asignar después)</span>
                    </label>
                    {plans.map((plan) => (
                      <label key={plan.id} className="flex items-center">
                        <input
                          type="radio"
                          checked={planKey === plan.key}
                          onChange={() => setPlanKey(plan.key)}
                          className="mr-2"
                        />
                        <span>
                          {plan.name} - {plan.price_monthly_cents / 100}€/mes
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No hay planes disponibles. Se puede asignar después.
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Confirmar Creación
                </h2>
                <div className="rounded border border-gray-200 bg-gray-50 p-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Nombre:</span> {name}
                    </div>
                    <div>
                      <span className="font-medium">Slug:</span> {slug}
                    </div>
                    <div>
                      <span className="font-medium">Timezone:</span> {timezone}
                    </div>
                    <div>
                      <span className="font-medium">Owner Email:</span> {ownerEmail}
                    </div>
                    {ownerName && (
                      <div>
                        <span className="font-medium">Owner Name:</span> {ownerName}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Plan:</span>{" "}
                      {planKey
                        ? plans.find((p) => p.key === planKey)?.name || planKey
                        : "Sin plan"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mensajes de error */}
          {error && (
            <div className="mb-4 rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex justify-between">
            <button
              onClick={() => {
                if (step > 1) {
                  setStep((s) => (s - 1) as WizardStep);
                  setError(null);
                } else {
                  router.push("/admin");
                }
              }}
              className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
              disabled={loading}
            >
              {step === 1 ? "Cancelar" : "Atrás"}
            </button>
            <button
              onClick={handleNext}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Creando..."
                : step === 4
                  ? "Crear Barbería"
                  : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}








