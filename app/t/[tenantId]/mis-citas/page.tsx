import { createClientForServer } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicTenant } from "@/lib/tenant/public-api";
import { CancelBookingButton } from "../../components/CancelBookingButton";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const supabase = await createClientForServer({ cookieName: "sb-customer-auth" });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login`);
  }

  const tenant = await getPublicTenant(tenantId);
  if (!tenant) return <div>Tenant not found</div>;

  const { data: bookings } = await supabase.rpc("get_my_bookings_v1", { target_tenant_id: tenant.id });

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: (tenant as any).settings?.currency || "EUR",
    }).format(cents / 100);

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
            <p className="text-slate-600 font-medium">No tienes citas programadas.</p>
            <Link
              href="/servicios"
              className="mt-4 inline-block px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold"
              style={{ backgroundColor: "var(--tenant-brand)" }}
            >
              Reservar ahora
            </Link>
          </div>
        ) : (
          bookings.map((booking: any) => (
            <div key={booking.booking_id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
              <h3 className="font-bold text-slate-900 text-lg mb-1">{booking.service_name}</h3>
              <p className="text-slate-500 text-sm mb-3">
                {booking.duration_min}m • {formatPrice(Number(booking.price_cents))}
              </p>

              {["pending", "confirmed"].includes(booking.status) && (
                <div className="flex gap-2">
                  <CancelBookingButton
                    bookingId={booking.booking_id}
                    cancelAction={async () => {
                      "use server";
                      const supabase = await createClientForServer({ cookieName: "sb-customer-auth" });
                      await supabase.rpc("cancel_my_booking_v1", {
                        target_booking_id: booking.booking_id,
                        target_tenant_id: tenant.id,
                      });
                      redirect(`/mis-citas`);
                    }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

