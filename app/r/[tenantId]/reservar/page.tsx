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

    if (!service_id) {
        return (
            <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col p-6 text-center justify-center">
                <h2 className="text-lg font-bold text-slate-900">Reserva no iniciada</h2>
                <p className="text-slate-500 mb-4">Selecciona un servicio para comenzar.</p>
                <Link href={`/r/${tenantId}/servicios`} className="text-blue-600 font-medium">Ver Servicios</Link>
            </div>
        );
    }

    const services = await getPublicServices(tenant.id);
    const selectedService = services.find(s => s.id === service_id);

    if (!selectedService) {
        return (
            <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col p-6 text-center justify-center">
                <h2 className="text-lg font-bold text-red-600">Servicio no encontrado</h2>
                <p className="text-slate-500 mb-4">El servicio seleccionado no está disponible.</p>
                <Link href={`/r/${tenantId}/servicios`} className="text-blue-600 font-medium">Volver</Link>
            </div>
        );
    }

    const formatPrice = (cents: number) => {
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: tenant.settings.currency || "EUR",
        }).format(cents / 100);
    };

    return (
        <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white p-4 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-10">
                <Link href={`/r/${tenantId}/servicios`} className="text-slate-400 hover:text-slate-900">
                    ← Cancelar
                </Link>
                <h1 className="font-bold text-slate-900">Nueva Reserva</h1>
            </header>

            <div className="p-4 flex-1">
                {/* Service Summary Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Servicio seleccionado</h2>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xl font-bold text-slate-900">{selectedService.name}</span>
                        <span className="text-lg font-bold text-slate-900">{formatPrice(selectedService.price_cents)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        {selectedService.duration_min} minutos
                    </div>
                </div>

                {/* Interactive Form */}
                <BookingForm tenantId={tenant.id} service={selectedService} />
            </div>
        </div>
    );
}
