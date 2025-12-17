'use client';

import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";

export type Service = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
};

export type Slot = {
  slot_start: string;
  slot_end: string;
  staff_id: string;
  staff_name: string;
};

export type BookingWidgetProps = {
  tenantId: string;
  services: Service[];
  onBookingComplete?: (bookingId: string) => void;
};

export function BookingWidget({ tenantId, services, onBookingComplete }: BookingWidgetProps) {
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid"); // P1.2: Timezone del tenant
  
  // Datos del cliente (formulario)
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [step, setStep] = useState<'service' | 'date' | 'slot' | 'customer' | 'payment' | 'complete'>('service');

  const selectedServiceData = useMemo(() => {
    return services.find((s) => s.id === selectedService);
  }, [services, selectedService]);

  // Cargar slots disponibles cuando se selecciona servicio y fecha
  useEffect(() => {
    if (selectedService && selectedDate) {
      loadAvailableSlots();
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
    }
  }, [selectedService, selectedDate, selectedStaff, tenantId]);

  const loadAvailableSlots = async () => {
    if (!selectedService || !selectedDate) return;

    setLoadingSlots(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        tenant: tenantId,
        service_id: selectedService,
        date: selectedDate,
        days_ahead: "7", // Cargar 7 días
      });

      if (selectedStaff) {
        params.append("staff_id", selectedStaff);
      }

      const response = await fetch(`/api/availability?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar disponibilidad");
      }

      // P1.2: Actualizar timezone del tenant desde la respuesta
      if (data.timezone) {
        setTenantTimezone(data.timezone);
      }

      // Filtrar slots para la fecha seleccionada
      const dateStart = new Date(selectedDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(selectedDate);
      dateEnd.setHours(23, 59, 59, 999);

      const filteredSlots = (data.slots || []).filter((slot: Slot) => {
        const slotDate = new Date(slot.slot_start);
        return slotDate >= dateStart && slotDate <= dateEnd;
      });

      setAvailableSlots(filteredSlots);
    } catch (err: any) {
      setError(err?.message || "Error al cargar disponibilidad");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setSelectedDate("");
    setSelectedSlot(null);
    setStep('date');
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep('slot');
  };

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    setStep('customer');
  };

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail && !customerName) {
      setError("Email o nombre son requeridos");
      return;
    }
    setStep('payment');
    handleCheckout();
  };

  const handleCheckout = async () => {
    if (!selectedService || !selectedSlot) {
      setError("Selecciona servicio y slot");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Crear payment_intent
      const intentResponse = await fetch("/api/checkout/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          service_id: selectedService,
          staff_id: selectedSlot.staff_id,
          starts_at: selectedSlot.slot_start,
          customer_email: customerEmail || undefined,
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
        }),
      });

      const intentData = await intentResponse.json();

      if (!intentResponse.ok) {
        throw new Error(intentData.error || "Error al crear payment intent");
      }

      // 2. Confirmar pago (mock)
      const confirmResponse = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_intent_id: intentData.payment_intent_id,
          mock_payment: true,
        }),
      });

      const confirmData = await confirmResponse.json();

      if (!confirmResponse.ok) {
        throw new Error(confirmData.error || "Error al confirmar pago");
      }

      // 3. Éxito
      setSuccess("¡Reserva confirmada!");
      setStep('complete');
      if (onBookingComplete) {
        onBookingComplete(confirmData.booking_id);
      }
    } catch (err: any) {
      setError(err?.message || "Error al procesar reserva");
      setStep('customer');
    } finally {
      setLoading(false);
    }
  };

  // Generar fechas disponibles (próximos 30 días)
  const availableDates = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  }, []);

  // P1.2: Formateador de tiempo usando timezone del tenant
  const timeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: tenantTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, [tenantTimezone]);

  // Obtener staff único de los slots disponibles
  const availableStaff = useMemo(() => {
    const staffMap = new Map<string, string>();
    availableSlots.forEach((slot) => {
      if (!staffMap.has(slot.staff_id)) {
        staffMap.set(slot.staff_id, slot.staff_name);
      }
    });
    return Array.from(staffMap.entries()).map(([id, name]) => ({ id, name }));
  }, [availableSlots]);

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Reservar servicio</h1>

      {success && (
        <div className="rounded border border-green-500 bg-green-50 p-4 text-sm text-green-600">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Paso 1: Seleccionar servicio */}
      {step === 'service' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Selecciona un servicio</h2>
          <div className="space-y-2">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => handleServiceSelect(service.id)}
                className="w-full text-left rounded border p-4 hover:bg-gray-50 transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-gray-600">
                      {service.duration_min} minutos
                    </p>
                  </div>
                  <p className="font-semibold">
                    {(service.price_cents / 100).toFixed(2)} €
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 2: Seleccionar fecha */}
      {step === 'date' && selectedServiceData && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('service')}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← Volver
          </button>
          <h2 className="text-lg font-medium">Selecciona una fecha</h2>
          <div className="grid grid-cols-7 gap-2">
            {availableDates.map((date) => (
              <button
                key={date}
                onClick={() => handleDateSelect(date)}
                className={`p-2 rounded border text-sm ${
                  selectedDate === date
                    ? "bg-black text-white"
                    : "hover:bg-gray-50"
                }`}
              >
                {format(new Date(date), "d", { locale: es })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3: Seleccionar slot */}
      {step === 'slot' && selectedServiceData && selectedDate && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('date')}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← Volver
          </button>
          <h2 className="text-lg font-medium">
            Selecciona una hora para {format(new Date(selectedDate), "PPP", { locale: es })}
          </h2>
          
          {availableStaff.length > 1 && (
            <div className="space-y-2">
              <label className="font-medium text-sm">Barbero (opcional)</label>
              <select
                className="w-full rounded border p-2"
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
              >
                <option value="">Cualquier barbero</option>
                {availableStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loadingSlots ? (
            <p className="text-sm text-gray-600">Cargando disponibilidad...</p>
          ) : availableSlots.length === 0 ? (
            <p className="text-sm text-gray-600">
              No hay slots disponibles para esta fecha
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableSlots.map((slot, index) => {
                const slotDate = new Date(slot.slot_start);
                const isSelected = selectedSlot?.slot_start === slot.slot_start;
                // P1.2: Formatear hora usando timezone del tenant
                const timeString = timeFormatter.format(slotDate);
                
                // P1.2: Validar si el slot está en el pasado (bloquear si está en el pasado)
                // Nota: Los slots pasados ya están filtrados por la función SQL,
                // pero añadimos validación adicional en el frontend para mejor UX
                const isPast = slotDate < new Date();
                const isDisabled = isPast;
                
                return (
                  <button
                    key={index}
                    onClick={() => !isDisabled && handleSlotSelect(slot)}
                    disabled={isDisabled}
                    className={`p-2 rounded border text-sm ${
                      isSelected
                        ? "bg-black text-white"
                        : isDisabled
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "hover:bg-gray-50"
                    }`}
                    title={isDisabled ? "Este slot ya no está disponible" : ""}
                  >
                    {timeString}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Paso 4: Datos del cliente */}
      {step === 'customer' && selectedSlot && (
        <div className="space-y-4">
          <button
            onClick={() => setStep('slot')}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← Volver
          </button>
          <h2 className="text-lg font-medium">Datos de contacto</h2>
          <form onSubmit={handleCustomerSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium text-sm">Nombre *</label>
              <input
                type="text"
                className="w-full rounded border p-2"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-sm">Email *</label>
              <input
                type="email"
                className="w-full rounded border p-2"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-sm">Teléfono (opcional)</label>
              <input
                type="tel"
                className="w-full rounded border p-2"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-black text-white py-2 font-medium disabled:opacity-50"
            >
              {loading ? "Procesando..." : "Confirmar reserva"}
            </button>
          </form>
        </div>
      )}

      {/* Paso 5: Procesando pago */}
      {step === 'payment' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Procesando pago...</p>
        </div>
      )}

      {/* Paso 6: Completo */}
      {step === 'complete' && (
        <div className="space-y-4">
          <div className="rounded border border-green-500 bg-green-50 p-4">
            <h2 className="text-lg font-medium text-green-800">
              ¡Reserva confirmada!
            </h2>
            <p className="text-sm text-green-600 mt-2">
              Tu reserva ha sido confirmada. Recibirás un email de confirmación.
            </p>
          </div>
          <button
            onClick={() => {
              setStep('service');
              setSelectedService("");
              setSelectedDate("");
              setSelectedSlot(null);
              setCustomerEmail("");
              setCustomerName("");
              setCustomerPhone("");
              setSuccess(null);
            }}
            className="w-full rounded bg-black text-white py-2 font-medium"
          >
            Nueva reserva
          </button>
        </div>
      )}
    </div>
  );
}

