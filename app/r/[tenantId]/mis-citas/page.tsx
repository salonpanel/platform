import { createClientForServer } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicTenant } from "@/lib/tenant/public-api";

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
                    <span className="text-xs text-slate-400 truncate max-w-[100px]">{user.email}</span>
                    {/* Logout basic button logic would go here */}
                </div>
            </header>

            <div className="p-4 space-y-4">
                {!bookings || bookings.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            📅
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
                                <span>🕒 {booking.duration_min}m</span>
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
                                    {/* Placeholder for Reschedule */}
                                    <button disabled className="flex-1 py-2 text-xs font-bold text-slate-400 bg-slate-50 rounded-lg cursor-not-allowed">
                                        Reprogramar
                                    </button>
                                    {/* Cancel Button - Would call Server Action */}
                                    <form action={async () => {
                                        "use server";
                                        const supabase = await createClientForServer({ cookieName: "sb-customer-auth" });
                                        await supabase.rpc("cancel_my_booking_v1", {
                                            target_booking_id: booking.booking_id,
                                            target_tenant_id: tenant.id
                                        });
                                        redirect(`/r/${tenantId}/mis-citas`); // Refresh
                                    }} className="flex-1">
                                        <button type="submit" className="w-full py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                                            Cancelar
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Floating Nav Placeholder */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-2 flex justify-around max-w-md mx-auto">
                <Link href={`/r/${tenantId}`} className="p-2 text-slate-400 hover:text-slate-900 flex flex-col items-center">
                    <span className="text-xs">Inicio</span>
                </Link>
                <Link href={`/r/${tenantId}/servicios`} className="p-2 text-slate-400 hover:text-slate-900 flex flex-col items-center">
                    <span className="text-xs">Reservar</span>
                </Link>
                <Link href={`/r/${tenantId}/mis-citas`} className="p-2 text-blue-600 font-bold flex flex-col items-center">
                    <span className="text-xs">Mis Citas</span>
                </Link>
            </div>
        </div>
    );
}
