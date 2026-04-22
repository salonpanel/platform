"use client";

import { useEffect, useState } from "react";
import { fetchAvailabilityAction, submitBookingAction, createCheckoutSessionAction } from "../../actions";
import type { PublicService } from "@/lib/tenant/public-api";

export default function BookingForm({
  tenantId,
  service,
}: {
  tenantId: string;
  service: PublicService;
}) {
  const [step, setStep] = useState<"slot" | "details" | "success">("slot");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [slots, setSlots] = useState<{ slot_time: string; available: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingSlots(true);
      const res = await fetchAvailabilityAction(tenantId, service.id, selectedDate);
      setSlots(res);
      setLoadingSlots(false);
    }
    load();
  }, [tenantId, service.id, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setFormError(null);

    const res = await submitBookingAction({
      tenantId,
      serviceId: service.id,
      slotTime: selectedSlot,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
    });

    if (res.success && res.bookingId) {
      setBookingId(res.bookingId);
      setStep("success");
    } else {
      setFormError(res.error || "No se pudo confirmar la reserva. Inténtalo de nuevo.");
    }
    setSubmitting(false);
  };

  const handlePayment = async () => {
    if (!bookingId) return;
    setRedirecting(true);
    setFormError(null);
    try {
      const { url } = await createCheckoutSessionAction(bookingId);
      if (url) window.location.href = url;
    } catch (err: any) {
      setFormError(err?.message || "Error al iniciar el pago. Inténtalo de nuevo.");
      setRedirecting(false);
    }
  };

  if (step === "success") {
    return (
      <div className="text-center p-8 bg-green-50 rounded-2xl border border-green-100">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-green-900 mb-2">¡Reserva Recibida!</h2>
        <p className="text-green-700 mb-4">
          Hemos recibido tu solicitud de cita para el{" "}
          <strong>{selectedSlot ? new Date(selectedSlot).toLocaleString() : ""}</strong>.
        </p>
        <p className="text-sm text-green-600 mb-6">Revisa tu email ({guest.email}) para confirmar la reserva.</p>

        <div className="space-y-3">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{formError}</div>
          )}
          <button
            onClick={handlePayment}
            disabled={redirecting}
            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
            style={{ backgroundColor: "var(--tenant-brand)" }}
          >
            {redirecting ? "Redirigiendo a Stripe..." : "Pagar Ahora (Stripe)"}
          </button>
          <button onClick={() => window.location.assign("/")} className="w-full py-3 text-slate-400 font-medium">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const validateField = (field: "name" | "email", value: string) => {
    if (field === "name" && value.trim().length < 2) {
      setFieldErrors((prev) => ({ ...prev, name: "Introduce tu nombre completo." }));
    } else if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldErrors((prev) => ({ ...prev, email: "Introduce un email válido." }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {step === "slot" && (
        <div className="space-y-4">
          <div>
            <label htmlFor="booking-date" className="block text-sm font-medium text-slate-700 mb-1">
              Fecha
            </label>
            <input
              id="booking-date"
              type="date"
              className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlot(null);
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Horas Disponibles</label>
            {loadingSlots ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Cargando horas disponibles">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 bg-slate-100 rounded-xl text-slate-500">
                <span className="text-sm">No hay horas disponibles para esta fecha.</span>
                <span className="text-xs text-slate-400">Prueba con otro día.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.slot_time}
                    onClick={() => setSelectedSlot(slot.slot_time)}
                    className={`min-h-[48px] rounded-lg text-sm font-medium transition-all active:scale-[0.97] ${
                      selectedSlot === slot.slot_time
                        ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-600 ring-offset-2"
                        : "bg-white border border-slate-200 text-slate-700 hover:border-blue-400"
                    }`}
                    style={selectedSlot === slot.slot_time ? { backgroundColor: "var(--tenant-brand)" } : {}}
                    aria-pressed={selectedSlot === slot.slot_time}
                  >
                    {formatTime(slot.slot_time)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            disabled={!selectedSlot}
            onClick={() => setStep("details")}
            className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--tenant-brand)" }}
          >
            Continuar
          </button>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div>
            <label htmlFor="guest-name" className="block text-sm font-medium text-slate-700 mb-1">
              Nombre Completo
            </label>
            <input
              id="guest-name"
              type="text"
              required
              autoComplete="name"
              autoCapitalize="words"
              className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-shadow ${
                fieldErrors.name ? "border-red-400 bg-red-50" : "border-slate-200"
              }`}
              placeholder="Ej: Juan Pérez"
              value={guest.name}
              onChange={(e) => setGuest({ ...guest, name: e.target.value })}
              onBlur={(e) => validateField("name", e.target.value)}
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="guest-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="guest-email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-shadow ${
                fieldErrors.email ? "border-red-400 bg-red-50" : "border-slate-200"
              }`}
              placeholder="juan@ejemplo.com"
              value={guest.email}
              onChange={(e) => setGuest({ ...guest, email: e.target.value })}
              onBlur={(e) => validateField("email", e.target.value)}
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>

          <div>
            <label htmlFor="guest-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Teléfono <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <input
              id="guest-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              placeholder="+34 600 000 000"
              value={guest.phone}
              onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
            />
          </div>

          {formError && (
            <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep("slot")}
              className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold active:scale-[0.98] transition-transform"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={submitting || Object.keys(fieldErrors).length > 0}
              className="flex-[2] py-4 rounded-xl bg-slate-900 text-white font-bold shadow-lg disabled:opacity-70 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "var(--tenant-brand)" }}
            >
              {submitting ? "Confirmando..." : "Confirmar Reserva"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

