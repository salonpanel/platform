'use client';

import { useMemo, useState } from "react";
import { addMinutes, isAfter, setMilliseconds, setSeconds } from "date-fns";

export type PublicService = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  stripe_price_id: string | null;
};

type Props = {
  orgId: string;
  services: PublicService[];
  successAppointment?: {
    id: string;
    status: string;
  } | null;
  tenantTimezone?: string; // P1.2: Timezone del tenant
};

type Slot = {
  label: string;
  value: string;
};

function generateSlots(formatter: Intl.DateTimeFormat): Slot[] {
  const now = new Date();
  const start = setMilliseconds(setSeconds(new Date(now), 0), 0);
  const minute = start.getMinutes();
  if (minute < 30) {
    start.setMinutes(30, 0, 0);
  } else {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }

  const slots: Slot[] = [];
  for (let i = 0; i < 12; i += 1) {
    const slotDate = addMinutes(start, i * 30);
    if (!isAfter(slotDate, now)) continue;
    slots.push({
      label: formatter.format(slotDate),
      value: slotDate.toISOString(),
    });
  }
  return slots;
}

export function ReserveClient({ orgId, services, successAppointment, tenantTimezone = "Europe/Madrid" }: Props) {
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P1.2: Timezone del tenant (obtenido del servidor)
  
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: tenantTimezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [tenantTimezone]
  );
  const slots = useMemo(() => generateSlots(timeFormatter), [timeFormatter]);
  const selectedServiceData = useMemo(() => {
    return services.find((service) => service.id === selectedService);
  }, [services, selectedService]);

  const canPay = Boolean(selectedServiceData?.stripe_price_id);

  const handlePay = async () => {
    setError(null);
    if (!selectedService) {
      setError("Selecciona un servicio.");
      return;
    }
    if (!selectedSlot) {
      setError("Selecciona una hora.");
      return;
    }
    const priceId = selectedServiceData?.stripe_price_id;
    if (!priceId) {
      setError(
        "Este servicio no está disponible temporalmente. Consulta al establecimiento."
      );
      return;
    }

    try {
      setLoading(true);
      const holdResponse = await fetch("/api/reservations/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId, // P1.2: Mantener org_id para compatibilidad con endpoint legacy
          service_id: selectedService,
          starts_at: selectedSlot,
        }),
      });

      const holdData = await holdResponse.json();
      if (!holdResponse.ok) {
        throw new Error(holdData.error || "No se pudo crear la reserva.");
      }

      const appointmentId = holdData.appointment_id as string;
      const checkoutResponse = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          price_id: priceId,
          success_url: `${window.location.origin}/r/${orgId}?success=1&appointment=${appointmentId}`,
          cancel_url: `${window.location.origin}/r/${orgId}?cancel=1`,
        }),
      });

      const checkoutData = await checkoutResponse.json();
      if (!checkoutResponse.ok || !checkoutData.url) {
        throw new Error(checkoutData.error || "No se pudo iniciar el pago.");
      }

      window.location.href = checkoutData.url as string;
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado al iniciar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Reservar servicio</h1>

      {successAppointment && (
        <div className="rounded border border-green-500 bg-green-50 p-4 text-sm text-green-600">
          ¡Reserva confirmada! ({successAppointment.status})
        </div>
      )}

      <div className="space-y-2">
        <label className="font-medium text-sm">Servicio</label>
        <select
          className="w-full rounded border p-2"
          value={selectedService}
          onChange={(event) => setSelectedService(event.target.value)}
        >
          <option value="">Selecciona un servicio</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} · {(service.price_cents / 100).toFixed(2)} €
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="font-medium text-sm">Hora</label>
        <select
          className="w-full rounded border p-2"
          value={selectedSlot}
          onChange={(event) => setSelectedSlot(event.target.value)}
        >
          <option value="">Selecciona hora</option>
          {slots.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
      </div>

      {selectedServiceData && (
        <p className="text-sm text-gray-600">
          Duración estimada: {selectedServiceData.duration_min} minutos.
        </p>
      )}

      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!canPay && selectedService && (
        <div className="rounded border border-amber-500 bg-amber-50 p-3 text-sm text-amber-700">
          Este servicio aún no está disponible para pago online. Estamos
          actualizando la información.
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={loading || !canPay}
        className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? "Abriendo Checkout…" : "Pagar"}
      </button>
    </div>
  );
}

