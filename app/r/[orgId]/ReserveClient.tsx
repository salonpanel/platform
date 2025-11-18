'use client';

import { useMemo, useState } from "react";
import { addMinutes, isAfter, setMilliseconds, setSeconds, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CheckCircle2, Clock, Euro, User, Mail, Phone, Calendar, Sparkles } from "lucide-react";

export type PublicService = {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  stripe_price_id: string | null;
};

export type PublicServiceWithSlots = PublicService & {
  slots?: Array<{
    staff_id: string;
    time: string; // ISO or HH:mm per RPC; asumimos ISO/HH:mm y convertimos a label
  }>;
};

type Props = {
  orgId: string;
  services: PublicService[];
  servicesWithSlots?: PublicServiceWithSlots[];
  successAppointment?: {
    id: string;
    status: string;
  } | null;
  tenantTimezone?: string;
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

export function ReserveClient({ orgId, services, servicesWithSlots = [], successAppointment, tenantTimezone = "Europe/Madrid" }: Props) {
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [consent, setConsent] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string } | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [step, setStep] = useState<"service" | "time" | "details" | "confirm">("service");

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

  const slots = useMemo(() => {
    const svc = servicesWithSlots.find(s => s.id === selectedService);
    if (svc && Array.isArray(svc.slots) && svc.slots.length > 0) {
      return svc.slots.map(s => {
        const date = new Date(s.time);
        const label = Number.isNaN(date.getTime()) ? s.time : timeFormatter.format(date);
        const value = Number.isNaN(date.getTime()) ? s.time : date.toISOString();
        return { label, value };
      });
    }
    return generateSlots(timeFormatter);
  }, [servicesWithSlots, selectedService, timeFormatter]);

  const selectedServiceData = useMemo(() => {
    return services.find((service) => service.id === selectedService);
  }, [services, selectedService]);

  const canPay = Boolean(selectedServiceData?.stripe_price_id);

  const validateFields = () => {
    const errs: { email?: string; phone?: string } = {};
    if (customerEmail) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
      if (!emailOk) errs.email = "Email no válido";
    }
    if (customerPhone) {
      const phoneOk = /^[0-9+()\-\s]{6,20}$/.test(customerPhone.trim());
      if (!phoneOk) errs.phone = "Teléfono no válido";
    }
    setFieldErrors(Object.keys(errs).length ? errs : null);
    return Object.keys(errs).length === 0;
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setSelectedSlot("");
    setShowTimeModal(true);
    setStep("time");
  };

  const handleSlotSelect = (slotValue: string) => {
    setSelectedSlot(slotValue);
    setShowTimeModal(false);
    setStep("details");
  };

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
    if (!customerName && !customerEmail) {
      setError("Indica tu nombre o email para continuar.");
      return;
    }
    if (!consent) {
      setError("Debes aceptar la política de privacidad para continuar.");
      return;
    }
    if (!validateFields()) {
      setError("Revisa los campos marcados en rojo.");
      return;
    }
    const priceId = selectedServiceData?.stripe_price_id;
    if (!priceId) {
      setError("Este servicio no está disponible temporalmente. Consulta al establecimiento.");
      return;
    }

    try {
      setLoading(true);
      setStep("confirm");
      
      // 1) Crear hold (temporal)
      const holdResponse = await fetch("/api/reservations/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          service_id: selectedService,
          starts_at: selectedSlot,
        }),
      });

      const holdData = await holdResponse.json();
      if (!holdResponse.ok) {
        throw new Error(holdData.error || "No se pudo crear la reserva.");
      }

      // 2) Intent de checkout (crea payment_intent)
      const intentRes = await fetch("/api/checkout/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedService,
          starts_at: selectedSlot,
          customer_email: customerEmail || undefined,
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
        }),
      });
      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        throw new Error(intentData.error || "No se pudo iniciar el pago.");
      }

      // 3) Confirmación (mock) inmediata para finalizar booking
      const confirmRes = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_intent_id: intentData.payment_intent_id, mock_payment: true }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || "No se pudo confirmar el pago.");
      }

      // 4) Redirigir a success con el id (booking)
      const bookingId = confirmData.booking_id as string;
      window.location.href = `${window.location.origin}/r/${orgId}?success=1&appointment=${bookingId}`;
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado al iniciar el pago.");
      setStep("details");
    } finally {
      setLoading(false);
    }
  };

  // Vista de confirmación de éxito
  if (successAppointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
          className="w-full max-w-md glass rounded-2xl border border-white/10 shadow-[0px_12px_48px_rgba(0,0,0,0.5)] p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <CheckCircle2 className="h-20 w-20 text-emerald-400" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl"
              />
            </div>
          </motion.div>
          
          <h1 className="text-3xl font-bold text-white mb-2 font-satoshi">¡Reserva confirmada!</h1>
          <p className="text-slate-400 mb-6">Tu cita ha sido reservada exitosamente</p>
          
          <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
            <div className="flex items-center justify-center gap-2 text-slate-300 mb-2">
              <Calendar className="h-5 w-5" />
              <span className="text-sm font-medium">Estado: {successAppointment.status === "confirmed" ? "Confirmada" : successAppointment.status}</span>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            Recibirás un email de confirmación con todos los detalles de tu reserva.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-satoshi tracking-tight">
            Reserva tu cita
          </h1>
          <p className="text-slate-400 text-lg">Selecciona el servicio y la hora que mejor se adapte a ti</p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-4 mb-8"
        >
          {[
            { key: "service", label: "Servicio", icon: Sparkles },
            { key: "time", label: "Hora", icon: Clock },
            { key: "details", label: "Datos", icon: User },
          ].map((stepItem, idx) => {
            const Icon = stepItem.icon;
            const isActive = 
              (stepItem.key === "service" && step === "service") ||
              (stepItem.key === "time" && (step === "time" || step === "details" || step === "confirm")) ||
              (stepItem.key === "details" && (step === "details" || step === "confirm"));
            const isCompleted = 
              (stepItem.key === "service" && selectedService) ||
              (stepItem.key === "time" && selectedSlot) ||
              (stepItem.key === "details" && customerName && customerEmail);

            return (
              <div key={stepItem.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive || isCompleted
                        ? "bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/30"
                        : "bg-slate-700/50 text-slate-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs mt-2 font-medium ${isActive ? "text-white" : "text-slate-500"}`}>
                    {stepItem.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div
                    className={`w-16 h-0.5 mx-2 transition-all duration-300 ${
                      isCompleted ? "bg-gradient-to-r from-blue-500 to-cyan-400" : "bg-slate-700/50"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </motion.div>

        {/* Main Content Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="glass rounded-2xl border border-white/10 shadow-[0px_12px_48px_rgba(0,0,0,0.5)] p-8"
        >
          {/* Step 1: Service Selection */}
          {step === "service" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6 font-satoshi">Selecciona un servicio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service, idx) => (
                  <motion.button
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleServiceSelect(service.id)}
                    className={`group relative p-6 rounded-xl border-2 transition-all duration-300 text-left ${
                      selectedService === service.id
                        ? "border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-white font-satoshi">{service.name}</h3>
                      <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <Euro className="h-5 w-5" />
                        <span className="text-lg">{(service.price_cents / 100).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration_min} min</span>
                      </div>
                    </div>
                    {selectedService === service.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3 right-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Time Selection (Modal) */}
          <Modal
            isOpen={showTimeModal}
            onClose={() => {
              setShowTimeModal(false);
              if (!selectedSlot) setStep("service");
            }}
            title="Selecciona una hora"
            size="md"
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((slot, idx) => (
                <motion.button
                  key={slot.value}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSlotSelect(slot.value)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 font-medium ${
                    selectedSlot === slot.value
                      ? "border-blue-400 bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/20"
                      : "border-slate-700/50 bg-slate-800/30 text-slate-300 hover:border-slate-600 hover:bg-slate-800/50"
                  }`}
                >
                  {slot.label}
                </motion.button>
              ))}
            </div>
            {slots.length === 0 && (
              <p className="text-center text-slate-400 py-8">No hay horarios disponibles</p>
            )}
          </Modal>

          {/* Step 3: Customer Details */}
          {(step === "details" || step === "confirm") && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {step === "confirm" && loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-400 border-t-transparent mb-4"></div>
                  <p className="text-slate-400">Procesando tu reserva...</p>
                </div>
              ) : (
                <>
                  {/* Selected Service & Time Summary */}
                  {selectedServiceData && selectedSlot && (
                    <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Servicio</span>
                        <span className="text-white font-semibold">{selectedServiceData.name}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Hora</span>
                        <span className="text-white font-semibold">
                          {timeFormatter.format(new Date(selectedSlot))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm">Precio</span>
                        <span className="text-emerald-400 font-bold text-lg">
                          {(selectedServiceData.price_cents / 100).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  )}

                  <h2 className="text-2xl font-bold text-white mb-6 font-satoshi">Tus datos</h2>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <User className="h-4 w-4" />
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Juan Pérez"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </label>
                      <input
                        type="email"
                        className={`w-full rounded-lg border px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
                          fieldErrors?.email
                            ? "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-500/30"
                            : "border-slate-700/50 bg-slate-800/30 focus:border-blue-500 focus:ring-blue-500/30"
                        }`}
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="tu@email.com"
                      />
                      {fieldErrors?.email && (
                        <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                        <Phone className="h-4 w-4" />
                        Teléfono <span className="text-slate-500 text-xs font-normal">(opcional)</span>
                      </label>
                      <input
                        type="tel"
                        className={`w-full rounded-lg border px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${
                          fieldErrors?.phone
                            ? "border-red-500 bg-red-500/10 focus:border-red-500 focus:ring-red-500/30"
                            : "border-slate-700/50 bg-slate-800/30 focus:border-blue-500 focus:ring-blue-500/30"
                        }`}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+34 600 000 000"
                      />
                      {fieldErrors?.phone && (
                        <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>
                      )}
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50">
                      <input
                        id="consent"
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500/30"
                      />
                      <label htmlFor="consent" className="text-sm text-slate-300 leading-relaxed">
                        Acepto la{" "}
                        <a href="/legal/privacidad" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                          política de privacidad
                        </a>{" "}
                        y el tratamiento de mis datos para gestionar la reserva.
                      </label>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300"
                    >
                      {error}
                    </motion.div>
                  )}

                  {!canPay && selectedService && (
                    <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-300">
                      Este servicio aún no está disponible para pago online. Estamos actualizando la información.
                    </div>
                  )}

                  <div className="mt-8">
                    <Button
                      onClick={handlePay}
                      disabled={loading || !canPay || !consent || !customerName || !customerEmail}
                      isLoading={loading}
                      variant="primary"
                      size="lg"
                      className="w-full"
                    >
                      {loading ? "Procesando..." : `Reservar por ${selectedServiceData ? (selectedServiceData.price_cents / 100).toFixed(2) : "0.00"} €`}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
