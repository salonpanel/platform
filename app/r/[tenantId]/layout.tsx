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
        title: `${tenant.name} - Reserva Online`,
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
                <div className="text-center p-6">
                    <h1 className="text-3xl font-bold mb-4">Próximamente</h1>
                    <p className="text-slate-500">
                        El sistema de reservas online estará disponible muy pronto.
                    </p>
                </div>
            </div>
        );
    }

    // 2. Resolve Tenant
    const tenant = await getPublicTenant(tenantId);

    if (!tenant) {
        notFound(); // Triggers 404 page
    }

    if (!tenant.is_active) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-sm p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        {tenant.name}
                    </h1>
                    <p className="text-slate-500">
                        Este negocio no está disponible momentáneamente. Por favor contacta directamente con el centro.
                    </p>
                </div>
            </div>
        );
    }

    // 3. Render Public Layout with Branding
    // We use CSS variables for theming which pass down to all children
    const brandColor = tenant.settings.brand_color || "#0f172a";

    return (
        <div
            className="min-h-screen bg-slate-50 text-slate-900 font-sans"
            style={
                {
                    "--tenant-brand": brandColor,
                } as React.CSSProperties
            }
        >
            {/* 
        Ideally we would wrap this in a <PublicTenantProvider> 
        but for Phase 12.1 infra, simple props/css is enough. 
        We rely on the children pages to fetch specific data or we could pass it down via context if we implement one.
      */}
            {children}
        </div>
    );
}
