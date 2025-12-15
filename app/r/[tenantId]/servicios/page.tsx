import Link from "next/link";
import { getPublicTenant, getPublicServices } from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
    params,
}: {
    params: Promise<{ tenantId: string }>;
}) {
    const { tenantId } = await params;
    const tenant = await getPublicTenant(tenantId);

    if (!tenant) notFound();

    const services = await getPublicServices(tenant.id);

    // Group by category
    const groupedServices = services.reduce((acc, service) => {
        const cat = service.category || "Otros";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(service);
        return acc;
    }, {} as Record<string, typeof services>);

    // Helper currency formatter
    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: tenant.settings.currency || "EUR",
        }).format(cents / 100);
    };

    return (
        <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-20">
            {/* Header */}
            <header className="bg-white p-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
                <Link href={`/r/${tenantId}`} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-50 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="font-bold text-slate-900 text-lg">Servicios</h1>
            </header>

            {/* Content */}
            <div className="p-4 space-y-8">
                {services.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-slate-900 font-medium">No hay servicios disponibles</h3>
                        <p className="text-slate-500 text-sm mt-1">Este negocio aún no ha configurado sus servicios públicos.</p>
                    </div>
                ) : (
                    Object.entries(groupedServices).map(([category, items]) => (
                        <section key={category}>
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
                                {category}
                            </h2>
                            <div className="space-y-3">
                                {items.map((service) => (
                                    <Link
                                        key={service.id}
                                        href={`/r/${tenantId}/reservar?service_id=${service.id}`}
                                        className="block bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-[0.99] transition-transform"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-slate-900 mb-1">{service.name}</h3>
                                                {service.description && (
                                                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">{service.description}</p>
                                                )}
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {service.duration_min} min
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-bold text-slate-900 bg-slate-50 px-3 py-1 rounded-lg text-sm">
                                                    {formatPrice(service.price_cents)}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </div>
    );
}
