import Link from "next/link";
import { getPublicTenant, getPublicServices } from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";
import BookingForm from "./BookingForm";

export const dynamic = "force-dynamic";

export default async function BookingPage({
    params,
    searchParams,
}: {
    params: Promise<{ tenantId: string }>;
    searchParams: Promise<{ service_id?: string }>;
}) {
    const { tenantId } = await params;
    const { service_id } = await searchParams;

    const tenant = await getPublicTenant(tenantId);
    if (!tenant) notFound();

    const brand = tenant.primary_color || "#4FA1D8";

    if (!service_id) {
        return (
            <div style={{ maxWidth: "440px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "16px" }}>📅</div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f2f5fa", margin: "0 0 8px" }}>Selecciona un servicio</h2>
                <p style={{ fontSize: "14px", color: "#8898aa", margin: "0 0 24px", lineHeight: 1.6 }}>
                    Para comenzar a reservar, primero selecciona el servicio que deseas.
                </p>
                <Link
                    href={`/r/${tenantId}/servicios`}
                    style={{
                        display: "inline-block",
                        padding: "12px 24px",
                        borderRadius: "12px",
                        background: brand,
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "14px",
                        textDecoration: "none",
                    }}
                >
                    Ver servicios
                </Link>
            </div>
        );
    }

    const services = await getPublicServices(tenant.id);
    const selectedService = services.find(s => s.id === service_id);

    const formatPrice = (cents: number) =>
        new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);

    if (!selectedService) {
        return (
            <div style={{ maxWidth: "440px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f2f5fa", margin: "0 0 8px" }}>Servicio no encontrado</h2>
                <p style={{ fontSize: "14px", color: "#8898aa", margin: "0 0 24px" }}>El servicio seleccionado no está disponible.</p>
                <Link
                    href={`/r/${tenantId}/servicios`}
                    style={{
                        display: "inline-block",
                        padding: "12px 24px",
                        borderRadius: "12px",
                        background: "#0f131b",
                        border: "1px solid #1d2430",
                        color: "#c9d6e3",
                        fontWeight: 600,
                        fontSize: "14px",
                        textDecoration: "none",
                    }}
                >
                    Volver a servicios
                </Link>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "440px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <header style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px 20px",
                borderBottom: "1px solid #1d2430",
                background: "#0f131b",
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}>
                <Link
                    href={`/r/${tenantId}/servicios`}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: "#ffffff08",
                        border: "1px solid #1d2430",
                        color: "#8898aa",
                        textDecoration: "none",
                        fontSize: "18px",
                        lineHeight: 1,
                    }}
                >
                    ←
                </Link>
                <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#f2f5fa", margin: 0 }}>Nueva Reserva</h1>
            </header>

            <div style={{ padding: "20px", flex: 1 }}>

                {/* Service card */}
                <div style={{
                    padding: "20px",
                    background: "#0f131b",
                    border: "1px solid #1d2430",
                    borderRadius: "16px",
                    marginBottom: "20px",
                }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#8898aa", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                        Servicio seleccionado
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        <div>
                            <span style={{ fontSize: "18px", fontWeight: 700, color: "#f2f5fa" }}>{selectedService.name}</span>
                            <p style={{ fontSize: "13px", color: "#8898aa", margin: "4px 0 0" }}>⏱ {selectedService.duration_min} minutos</p>
                        </div>
                        <span style={{
                            fontSize: "18px",
                            fontWeight: 700,
                            color: brand,
                            background: brand + "15",
                            border: `1px solid ${brand}33`,
                            padding: "6px 14px",
                            borderRadius: "10px",
                            whiteSpace: "nowrap",
                        }}>
                            {formatPrice(selectedService.price_cents)}
                        </span>
                    </div>
                </div>

                {/* Booking Form */}
                <BookingForm tenantId={tenant.id} service={selectedService} brandColor={brand} />
            </div>
        </div>
    );
}
