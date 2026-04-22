import { createClientForServer } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicTenant } from "@/lib/tenant/public-api";
import { CancelBookingButton } from "./CancelBookingButton";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;

    // 1. Auth Guard (Customer Session)
    const supabase = await createClientForServer({ cookieName: "sb-customer-auth" });
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        redirect(`/r/${tenantId}/login`);
    }

    // 2. Fetch Tenant Context
    const tenant = await getPublicTenant(tenantId);
    if (!tenant) return <div>Tenant not found</div>;

    // 3. Fetch Bookings (RPC)
    const { data: bookings, error: rpcError } = await supabase
        .rpc("get_my_bookings_v1", { target_tenant_id: tenant.id });

    if (rpcError) {
        console.error("Error fetching bookings:", rpcError);
    }

    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
        }).format(cents / 100);
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleString("es-ES", {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const brand = tenant.primary_color || "#4FA1D8";

    const statusBadge = (status: string) => {
        const map: Record<string, { label: string; bg: string; color: string }> = {
            confirmed: { label: "Confirmada", bg: "#1EA19F22", color: "#1EA19F" },
            pending: { label: "Pendiente", bg: "#f59e0b22", color: "#f59e0b" },
            cancelled: { label: "Cancelada", bg: "#f8717122", color: "#f87171" },
        };
        const s = map[status] || { label: status, bg: "#ffffff10", color: "#8898aa" };
        return (
            <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: s.bg, color: s.color }}>
                {s.label}
            </span>
        );
    };

    return (
        <div style={{ maxWidth: "440px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: "80px" }}>

            {/* Header */}
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #1d2430", background: "#0f131b", position: "sticky", top: 0, zIndex: 10 }}>
                <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#f2f5fa", margin: 0 }}>Mis Citas</h1>
                <span style={{ fontSize: "12px", color: "#4a5568", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                </span>
            </header>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                {!bookings || bookings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 24px" }}>
                        <div style={{ fontSize: "40px", marginBottom: "16px" }}>📅</div>
                        <p style={{ fontSize: "16px", fontWeight: 600, color: "#f2f5fa", margin: "0 0 6px" }}>Sin citas programadas</p>
                        <p style={{ fontSize: "14px", color: "#8898aa", margin: "0 0 24px" }}>Reserva tu primera cita ahora</p>
                        <Link
                            href={`/r/${tenantId}/servicios`}
                            style={{ display: "inline-block", padding: "12px 24px", borderRadius: "12px", background: brand, color: "#fff", fontWeight: 600, fontSize: "14px", textDecoration: "none" }}
                        >
                            Reservar ahora
                        </Link>
                    </div>
                ) : (
                    bookings.map((booking: any) => (
                        <div key={booking.booking_id} style={{ padding: "18px 20px", background: "#0f131b", border: "1px solid #1d2430", borderRadius: "16px", position: "relative" }}>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f2f5fa", margin: 0 }}>{booking.service_name}</h3>
                                {statusBadge(booking.status)}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px", background: "#ffffff06", border: "1px solid #1d2430", borderRadius: "12px", marginBottom: "12px" }}>
                                <div style={{ textAlign: "center", background: "#0f131b", border: "1px solid #1d2430", borderRadius: "10px", padding: "8px 12px", minWidth: "50px" }}>
                                    <span style={{ display: "block", fontSize: "10px", color: brand, fontWeight: 700, textTransform: "uppercase" }}>
                                        {new Date(booking.start_time).toLocaleDateString("es-ES", { month: "short" })}
                                    </span>
                                    <span style={{ display: "block", fontSize: "22px", fontWeight: 800, color: "#f2f5fa", lineHeight: 1 }}>
                                        {new Date(booking.start_time).getDate()}
                                    </span>
                                </div>
                                <div>
                                    <p style={{ fontSize: "15px", fontWeight: 600, color: "#f2f5fa", margin: "0 0 2px" }}>
                                        {new Date(booking.start_time).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                    <p style={{ fontSize: "12px", color: "#8898aa", margin: 0, textTransform: "capitalize" }}>
                                        {new Date(booking.start_time).toLocaleDateString("es-ES", { weekday: "long" })} · {booking.duration_min}min · {formatPrice(booking.price_cents)}
                                    </p>
                                </div>
                            </div>

                            {["pending", "confirmed"].includes(booking.status) && (
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button disabled style={{ flex: 1, padding: "10px", fontSize: "12px", fontWeight: 600, color: "#4a5568", background: "#ffffff06", border: "1px solid #1d2430", borderRadius: "10px", cursor: "not-allowed" }}>
                                        Reprogramar
                                    </button>
                                    <CancelBookingButton
                                        bookingId={booking.booking_id}
                                        cancelAction={async () => {
                                            "use server";
                                            const supabase = await createClientForServer({ cookieName: "sb-customer-auth" });
                                            await supabase.rpc("cancel_my_booking_v1", {
                                                target_booking_id: booking.booking_id,
                                                target_tenant_id: tenant.id
                                            });
                                            redirect(`/r/${tenantId}/mis-citas`);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Nav */}
            <nav style={{
                position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
                width: "100%", maxWidth: "440px",
                background: "#0f131b", borderTop: "1px solid #1d2430",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                zIndex: 20,
            }}>
                <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 0" }}>
                    {[
                        { href: `/r/${tenantId}`, label: "Inicio", icon: "🏠" },
                        { href: `/r/${tenantId}/servicios`, label: "Reservar", icon: "✂️" },
                        { href: `/r/${tenantId}/mis-citas`, label: "Mis Citas", icon: "📅", active: true },
                    ].map(({ href, label, icon, active }) => (
                        <Link
                            key={href}
                            href={href}
                            style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                                padding: "8px 16px",
                                textDecoration: "none",
                                color: active ? brand : "#4a5568",
                                fontSize: "10px", fontWeight: active ? 700 : 500,
                                letterSpacing: "0.02em",
                                textTransform: "uppercase",
                            }}
                        >
                            <span style={{ fontSize: "20px" }}>{icon}</span>
                            {label}
                        </Link>
                    ))}
                </div>
            </nav>
        </div>
    );
}
