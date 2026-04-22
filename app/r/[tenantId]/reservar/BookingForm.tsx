"use client";

import { useState, useEffect } from "react";
import { fetchAvailabilityAction, submitBookingAction, createCheckoutSessionAction } from "../../actions";
import { PublicService } from "@/lib/tenant/public-api";

export default function BookingForm({
    tenantId,
    service,
    brandColor = "#4FA1D8",
}: {
    tenantId: string;
    service: PublicService;
    brandColor?: string;
}) {
    const [step, setStep] = useState<"slot" | "details" | "success">("slot");
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
    const [slots, setSlots] = useState<{ slot_time: string; available: boolean }[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [redirecting, setRedirecting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

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
        setFormError(null);

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

    const validateField = (field: "name" | "email", value: string) => {
        if (field === "name" && value.trim().length < 2) {
            setFieldErrors(prev => ({ ...prev, name: "Introduce tu nombre completo." }));
        } else if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            setFieldErrors(prev => ({ ...prev, email: "Introduce un email válido." }));
        } else {
            setFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
        }
    };

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // ── Success screen ──
    if (step === "success") {
        return (
            <div style={{ textAlign: "center", padding: "32px 24px", background: "#0f131b", border: "1px solid #1d2430", borderRadius: "20px" }}>
                <div style={{
                    width: "64px", height: "64px",
                    borderRadius: "50%",
                    background: "#1EA19F22",
                    border: "1px solid #1EA19F44",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                    fontSize: "28px",
                }}>✓</div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f2f5fa", margin: "0 0 8px" }}>¡Reserva recibida!</h2>
                <p style={{ fontSize: "14px", color: "#8898aa", margin: "0 0 6px", lineHeight: 1.6 }}>
                    Solicitud de cita para el{" "}
                    <strong style={{ color: "#c9d6e3" }}>
                        {selectedSlot ? new Date(selectedSlot).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" }) : ""}
                    </strong>
                </p>
                <p style={{ fontSize: "13px", color: "#4a5568", margin: "0 0 24px" }}>
                    Revisa tu email ({guest.email}) para confirmar.
                </p>

                {formError && (
                    <div style={{ padding: "12px 16px", borderRadius: "12px", background: "#ff000015", border: "1px solid #ff000030", color: "#f87171", fontSize: "13px", marginBottom: "16px" }}>
                        {formError}
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button
                        onClick={handlePayment}
                        disabled={redirecting}
                        style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: "12px",
                            background: brandColor,
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "15px",
                            border: "none",
                            cursor: "pointer",
                            opacity: redirecting ? 0.7 : 1,
                        }}
                    >
                        {redirecting ? "Redirigiendo a Stripe..." : "Pagar ahora"}
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "12px",
                            background: "transparent",
                            color: "#8898aa",
                            fontWeight: 500,
                            fontSize: "14px",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    // ── Shared input style ──
    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "12px 14px",
        borderRadius: "12px",
        background: "#0f131b",
        border: "1px solid #1d2430",
        color: "#f2f5fa",
        fontSize: "14px",
        outline: "none",
        boxSizing: "border-box",
        appearance: "none",
        WebkitAppearance: "none",
    };

    const labelStyle: React.CSSProperties = {
        display: "block",
        fontSize: "12px",
        fontWeight: 600,
        color: "#8898aa",
        marginBottom: "6px",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Step 1: Slot Selection */}
            {step === "slot" && (
                <>
                    <div>
                        <label htmlFor="booking-date" style={labelStyle}>Fecha</label>
                        <input
                            id="booking-date"
                            type="date"
                            value={selectedDate}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
                            style={{ ...inputStyle, colorScheme: "dark" }}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Horas disponibles</label>
                        {loadingSlots ? (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} style={{ height: "48px", borderRadius: "10px", background: "#0f131b", animation: "pulse 1.5s infinite" }} />
                                ))}
                            </div>
                        ) : slots.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "32px 16px", background: "#0f131b", border: "1px solid #1d2430", borderRadius: "14px" }}>
                                <div style={{ fontSize: "28px", marginBottom: "8px" }}>📅</div>
                                <p style={{ fontSize: "14px", color: "#8898aa", margin: "0 0 4px" }}>No hay horas disponibles</p>
                                <p style={{ fontSize: "12px", color: "#4a5568", margin: 0 }}>Prueba con otro día.</p>
                            </div>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                {slots.map((slot) => {
                                    const isSelected = selectedSlot === slot.slot_time;
                                    return (
                                        <button
                                            key={slot.slot_time}
                                            onClick={() => setSelectedSlot(slot.slot_time)}
                                            disabled={!slot.available}
                                            style={{
                                                minHeight: "48px",
                                                borderRadius: "10px",
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                border: isSelected ? `2px solid ${brandColor}` : "1px solid #1d2430",
                                                background: isSelected ? brandColor + "22" : "#0f131b",
                                                color: isSelected ? brandColor : slot.available ? "#c9d6e3" : "#4a5568",
                                                cursor: slot.available ? "pointer" : "not-allowed",
                                                opacity: slot.available ? 1 : 0.4,
                                                transition: "all 0.15s",
                                            }}
                                        >
                                            {formatTime(slot.slot_time)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button
                        disabled={!selectedSlot}
                        onClick={() => setStep("details")}
                        style={{
                            width: "100%",
                            padding: "16px",
                            borderRadius: "14px",
                            background: brandColor,
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "16px",
                            border: "none",
                            cursor: selectedSlot ? "pointer" : "not-allowed",
                            opacity: selectedSlot ? 1 : 0.4,
                            marginTop: "4px",
                        }}
                    >
                        Continuar
                    </button>
                </>
            )}

            {/* Step 2: Guest Details */}
            {step === "details" && (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Selected slot reminder */}
                    <div style={{
                        padding: "12px 16px",
                        background: brandColor + "15",
                        border: `1px solid ${brandColor}33`,
                        borderRadius: "12px",
                        fontSize: "13px",
                        color: brandColor,
                        fontWeight: 500,
                    }}>
                        📅 {selectedSlot ? new Date(selectedSlot).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" }) : ""}
                    </div>

                    <div>
                        <label htmlFor="guest-name" style={labelStyle}>Nombre completo</label>
                        <input
                            id="guest-name"
                            type="text"
                            required
                            autoComplete="name"
                            autoCapitalize="words"
                            placeholder="Ej: Juan Pérez"
                            value={guest.name}
                            onChange={e => setGuest({ ...guest, name: e.target.value })}
                            onBlur={e => validateField("name", e.target.value)}
                            style={{ ...inputStyle, borderColor: fieldErrors.name ? "#f87171" : "#1d2430" }}
                        />
                        {fieldErrors.name && <p style={{ fontSize: "12px", color: "#f87171", margin: "4px 0 0" }}>{fieldErrors.name}</p>}
                    </div>

                    <div>
                        <label htmlFor="guest-email" style={labelStyle}>Email</label>
                        <input
                            id="guest-email"
                            type="email"
                            required
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="juan@ejemplo.com"
                            value={guest.email}
                            onChange={e => setGuest({ ...guest, email: e.target.value })}
                            onBlur={e => validateField("email", e.target.value)}
                            style={{ ...inputStyle, borderColor: fieldErrors.email ? "#f87171" : "#1d2430" }}
                        />
                        {fieldErrors.email && <p style={{ fontSize: "12px", color: "#f87171", margin: "4px 0 0" }}>{fieldErrors.email}</p>}
                    </div>

                    <div>
                        <label htmlFor="guest-phone" style={labelStyle}>
                            Teléfono <span style={{ color: "#4a5568", textTransform: "none", fontWeight: 400 }}>(Opcional)</span>
                        </label>
                        <input
                            id="guest-phone"
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="+34 600 000 000"
                            value={guest.phone}
                            onChange={e => setGuest({ ...guest, phone: e.target.value })}
                            style={inputStyle}
                        />
                    </div>

                    {formError && (
                        <div role="alert" style={{ padding: "12px 16px", borderRadius: "12px", background: "#ff000015", border: "1px solid #ff000030", color: "#f87171", fontSize: "13px" }}>
                            {formError}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                        <button
                            type="button"
                            onClick={() => setStep("slot")}
                            style={{
                                flex: 1,
                                padding: "14px",
                                borderRadius: "12px",
                                background: "#0f131b",
                                border: "1px solid #1d2430",
                                color: "#8898aa",
                                fontWeight: 600,
                                fontSize: "14px",
                                cursor: "pointer",
                            }}
                        >
                            Atrás
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || Object.keys(fieldErrors).length > 0}
                            style={{
                                flex: 2,
                                padding: "14px",
                                borderRadius: "12px",
                                background: brandColor,
                                border: "none",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: "15px",
                                cursor: submitting ? "not-allowed" : "pointer",
                                opacity: (submitting || Object.keys(fieldErrors).length > 0) ? 0.7 : 1,
                            }}
                        >
                            {submitting ? "Confirmando..." : "Confirmar reserva"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
