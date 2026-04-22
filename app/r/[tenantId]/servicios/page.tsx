import Link from "next/link";
import { getPublicTenant, getPublicServices } from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
    params,
}: {
    params: { tenantId: string };
}) {
    const { tenantId } = params;
    const tenant = await getPublicTenant(tenantId);

    if (!tenant) notFound();

    const services = await getPublicServices(tenant.id);

    // Group by category
    const groupedServices = services.reduce((acc, service) => {
        const cat = service.category || "Servicios";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(service);
        return acc;
    }, {} as Record<string, typeof services>);

    const formatPrice = (cents: number) =>
        new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);

    const brand = tenant.primary_color || "#4FA1D8";

    return (
        <div style={{ maxWidth: "440px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: "80px" }}>

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
                    href={`/r/${tenantId}`}
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
                <h1 style={{ fontSize: "17px", fontWeight: 700, color: "#f2f5fa", margin: 0 }}>Servicios</h1>
            </header>

            {/* Content */}
            <div style={{ padding: "20px", flex: 1 }}>
                {services.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 24px" }}>
                        <div style={{
                            width: "64px", height: "64px",
                            borderRadius: "50%",
                            background: "#0f131b",
                            border: "1px solid #1d2430",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 16px",
                            fontSize: "28px",
                        }}>✂️</div>
                        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#f2f5fa", margin: "0 0 6px" }}>
                            Sin servicios disponibles
                        </h3>
                        <p style={{ fontSize: "14px", color: "#8898aa", margin: 0, lineHeight: 1.5 }}>
                            Este negocio aún no ha configurado sus servicios. Vuelve pronto.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                        {Object.entries(groupedServices).map(([category, items]) => (
                            <section key={category}>
                                <h2 style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: "#8898aa",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    margin: "0 0 12px",
                                    paddingLeft: "2px",
                                }}>
                                    {category}
                                </h2>
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {items.map((service) => (
                                        <Link
                                            key={service.id}
                                            href={`/r/${tenantId}/reservar?service_id=${service.id}`}
                                            style={{
                                                display: "block",
                                                padding: "18px 20px",
                                                background: "#0f131b",
                                                border: "1px solid #1d2430",
                                                borderRadius: "16px",
                                                textDecoration: "none",
                                                transition: "border-color 0.15s",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#f2f5fa", margin: "0 0 4px" }}>
                                                        {service.name}
                                                    </h3>
                                                    {service.description && (
                                                        <p style={{ fontSize: "13px", color: "#8898aa", margin: "0 0 8px", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                                                            {service.description}
                                                        </p>
                                                    )}
                                                    <span style={{ fontSize: "12px", color: "#4a5568" }}>
                                                        ⏱ {service.duration_min} min
                                                    </span>
                                                </div>
                                                <div style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "flex-end",
                                                    gap: "8px",
                                                    shrink: 0,
                                                } as React.CSSProperties}>
                                                    <span style={{
                                                        fontSize: "15px",
                                                        fontWeight: 700,
                                                        color: "#f2f5fa",
                                                        background: "#ffffff08",
                                                        border: "1px solid #1d2430",
                                                        padding: "4px 10px",
                                                        borderRadius: "8px",
                                                        whiteSpace: "nowrap",
                                                    }}>
                                                        {formatPrice(service.price_cents)}
                                                    </span>
                                                    <span style={{ fontSize: "12px", color: brand }}>Reservar →</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
