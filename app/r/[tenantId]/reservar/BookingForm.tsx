"use client";

import { useState, useEffect } from "react";
import { fetchAvailabilityAction, submitBookingAction, createCheckoutSessionAction } from "../../actions";
import { PublicService } from "@/lib/tenant/public-api";

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

    const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
    const [submitting, setSubmitting] = useState(false);

    // Load slots on date change
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

        const res = await submitBookingAction({
            tenantId,
            serviceId: service.id,
            slotTime: selectedSlot,
            name: guest.name,
            email: guest.email,
            phone: guest.phone
        });

        if (res.success && res.bookingId) {
            setBookingId(res.bookingId);
            setStep("success");
        } else {
            alert("Error: " + (res.error || "Unknown error"));
        }
        setSubmitting(false);
    };

    const handlePayment = async () => {
        if (!bookingId) return;
        setRedirecting(true);
        try {
            const { url } = await createCheckoutSessionAction(bookingId);
            if (url) {
                window.location.href = url;
            }
        } catch (err) {
            alert("Error iniciando pago: " + err);
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
                    Hemos recibido tu solicitud de cita para el <strong>{selectedSlot ? new Date(selectedSlot).toLocaleString() : ""}</strong>.
                </p>
                <p className="text-sm text-green-600 mb-6">
                    Revisa tu email ({guest.email}) para confirmar la reserva.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={handlePayment}
                        disabled={redirecting}
                        className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                        style={{ backgroundColor: "var(--tenant-brand)" }}
                    >
                        {redirecting ? "Redirigiendo a Stripe..." : "Pagar Ahora (Stripe)"}
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-3 text-slate-400 font-medium"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    const formatTime = (iso: string) => {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            {/* Step 1: Slot Selection */}
            {step === "slot" && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            className="w-full p-3 rounded-xl border border-slate-200 bg-white"
                            value={selectedDate}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Horas Disponibles</label>
                        {loadingSlots ? (
                            <div className="text-center py-8 text-slate-400">Cargando disponibilidad...</div>
                        ) : slots.length === 0 ? (
                            <div className="text-center p-4 bg-slate-100 rounded-xl text-slate-500">
                                No hay horas disponibles para esta fecha.
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {slots.map((slot) => (
                                    <button
                                        key={slot.slot_time}
                                        onClick={() => setSelectedSlot(slot.slot_time)}
                                        className={`p-3 rounded-lg text-sm font-medium transition-all ${selectedSlot === slot.slot_time
                                            ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-600 ring-offset-2'
                                            : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-400'
                                            }`}
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
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                        style={{ backgroundColor: "var(--tenant-brand)" }}
                    >
                        Continuar
                    </button>
                </div>
            )}

// cleaned
            {step === "details" && (
                <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: Juan Pérez"
                            value={guest.name}
                            onChange={e => setGuest({ ...guest, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="juan@ejemplo.com"
                            value={guest.email}
                            onChange={e => setGuest({ ...guest, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (Opcional)</label>
                        <input
                            type="tel"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="+34 600..."
                            value={guest.phone}
                            onChange={e => setGuest({ ...guest, phone: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setStep("slot")}
                            className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold"
                        >
                            Atrás
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-[2] py-4 rounded-xl bg-slate-900 text-white font-bold shadow-lg disabled:opacity-70"
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
