import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/tenant/public-api";
import { Metadata } from "next";

// Force dynamic because we rely on slug params and DB
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tenantId: string }> }): Promise<Metadata> {
    const { tenantId } = await params;
    const tenant = await getPublicTenant(tenantId);

    if (!tenant) {
        return { title: "BookFast" };
    }

    return {
        title: `${tenant.name} — Reserva Online`,
        description: `Reserva tu cita en ${tenant.name} de forma rápida y sencilla.`,
    };
}

export default async function PublicTenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;

    // 1. Feature Flag Check
    const pwaEnabled = process.env.NEXT_PUBLIC_PWA_ENABLED === "true";
    if (!pwaEnabled) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a", color: "#f2f5fa" }}>
                <div style={{ textAlign: "center", padding: "24px" }}>
                    <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "12px" }}>Próximamente</h1>
                    <p style={{ color: "#8898aa", fontSize: "15px" }}>
                        El sistema de reservas online estará disponible muy pronto.
                    </p>
                </div>
            </div>
        );
    }

    // 2. Resolve Tenant
    const tenant = await getPublicTenant(tenantId);

    if (!tenant) {
        notFound();
    }

    if (!tenant.is_active) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a" }}>
                <div style={{
                    textAlign: "center",
                    maxWidth: "360px",
                    padding: "32px",
                    background: "#0f131b",
                    border: "1px solid #1d2430",
                    borderRadius: "20px",
                }}>
                    <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#f2f5fa", marginBottom: "8px" }}>
                        {tenant.name}
                    </h1>
                    <p style={{ color: "#8898aa", fontSize: "14px", lineHeight: 1.6 }}>
                        Este negocio no está disponible momentáneamente. Por favor contacta directamente con el centro.
                    </p>
                </div>
            </div>
        );
    }

    // 3. Render Public Layout with Branding
    const brandColor = tenant.primary_color || "#4FA1D8";

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#05070a",
                color: "#f2f5fa",
                fontFamily: "var(--font-sans, 'Geist', system-ui, sans-serif)",
                "--tenant-brand": brandColor,
            } as React.CSSProperties}
        >
            {children}
        </div>
    );
}
