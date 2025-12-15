import Link from "next/link";
import { getPublicTenant } from "@/lib/tenant/public-api";
import { notFound } from "next/navigation";

export default async function TenantHomePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);

    if (!tenant) notFound();

    return (
        <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl shadow-slate-200 overflow-hidden flex flex-col">
            {/* Hero Section */}
            <div
                className="relative h-64 bg-slate-900 flex items-end p-6"
                style={{ backgroundColor: "var(--tenant-brand)" }}
            >
                <div className="relative z-10 text-white">
                    <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
                    <p className="opacity-90 mt-1 text-sm">Reserva tu cita online</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex-1 p-6 space-y-4">
                <Link
                    href={`/r/${slug}/reservar`}
                    className="block w-full text-center py-4 px-6 rounded-xl text-white font-semibold text-lg shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                    style={{ backgroundColor: "var(--tenant-brand)" }}
                >
                    Reservar Ahora
                </Link>

                <Link
                    href={`/r/${slug}/servicios`}
                    className="block w-full text-center py-4 px-6 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
                >
                    Ver Servicios
                </Link>

                {/* Info Card */}
                <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Sobre nosotros</h3>
                    <p className="text-sm text-slate-500">
                        Bienvenido a {tenant.name}. Usa esta aplicación para gestionar tus reservas de forma rápida y sencilla.
                    </p>
                </div>
            </div>

            {/* Footer */}
            <footer className="p-6 text-center text-xs text-slate-400">
                <p>Powered by <strong>BookFast</strong></p>
            </footer>
        </main>
    );
}
