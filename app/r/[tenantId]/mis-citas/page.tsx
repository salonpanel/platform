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
            currency: tenant.settings.currency || "EUR"
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

    return (
        <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-20">
            <header className="bg-white p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                <h1 className="font-bold text-slate-900">Mis Citas</h1>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 truncate max-w-[160px] sm:max-w-none">{user.email}</span>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {!bookings || bookings.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-slate-600 font-medium">No tienes citas programadas.</p>
                        <Link
                            href={`/r/${tenantId}/servicios`}
                            className="mt-4 inline-block px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold"
                            style={{ backgroundColor: "var(--tenant-brand)" }}
                        >
                            Reservar ahora
                        </Link>
                    </div>
                ) : (
                    bookings.map((booking: any) => (
                        <div key={booking.booking_id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                    booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-500'
                                    }`}>
                                    {booking.status === 'pending' ? 'Pendiente' :
                                        booking.status === 'confirmed' ? 'Confirmada' :
                                            booking.status}
                                </span>
                            </div>

                            <h3 className="font-bold text-slate-900 text-lg mb-1">{booking.service_name}</h3>
                            <p className="text-slate-500 text-sm mb-3 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {booking.duration_min}m
                                </span>
                                <span>•</span>
                                <span>{formatPrice(booking.price_cents)}</span>
                            </p>

                            <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3 mb-3">
                                <div className="text-center bg-white p-2 rounded border border-slate-200 min-w-[50px]">
                                    <span className="block text-xs text-red-500 font-bold uppercase">{new Date(booking.start_time).toLocaleDateString('es-ES', { month: 'short' })}</span>
                                    <span className="block text-xl font-bold text-slate-900">{new Date(booking.start_time).getDate()}</span>
                                </div>
                                <div>
                                    <p className="text-slate-900 font-medium">
                                        {new Date(booking.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-xs text-slate-400 capitalize">
                                        {new Date(booking.start_time).toLocaleDateString('es-ES', { weekday: 'long' })}
                                    </p>
                                </div>
                            </div>

                            {['pending', 'confirmed'].includes(booking.status) && (
                                <div className="flex gap-2">
                                    <button disabled className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-50 rounded-lg cursor-not-allowed">
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
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 max-w-md mx-auto"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                <div className="flex justify-around p-2">
                    <Link href={`/r/${tenantId}`} className="flex flex-col items-center gap-1 p-2 min-w-[56px] text-slate-400 hover:text-slate-900 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="text-xs">Inicio</span>
                    </Link>
                    <Link href={`/r/${tenantId}/servicios`} className="flex flex-col items-center gap-1 p-2 min-w-[56px] text-slate-400 hover:text-slate-900 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs">Reservar</span>
                    </Link>
                    <Link href={`/r/${tenantId}/mis-citas`} className="flex flex-col items-center gap-1 p-2 min-w-[56px] text-blue-600 font-bold transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">Mis Citas</span>
                    </Link>
                </div>
            </nav>
        </div>
    );
}
