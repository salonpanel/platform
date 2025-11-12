import { supabaseServer } from "@/lib/supabase";
import { ReserveClient, PublicService } from "./ReserveClient";

type Props = {
  params: { orgId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = "force-dynamic";

export default async function ReservePage({ params, searchParams }: Props) {
  const supabase = supabaseServer();

  // P1.2: Resolver tenant_id (puede ser UUID o slug)
  // Intentar primero por ID (UUID)
  let tenantId: string | null = null;
  let tenantTimezone: string = "Europe/Madrid";
  let { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("id, timezone")
    .eq("id", params.orgId)
    .maybeSingle();

  // Si no se encuentra por ID, intentar por slug
  if (!tenantData && !tenantError) {
    const { data: tenantBySlug, error: slugError } = await supabase
      .from("tenants")
      .select("id, timezone")
      .eq("slug", params.orgId)
      .maybeSingle();
    
    tenantData = tenantBySlug;
    tenantError = slugError;
  }

  if (tenantError || !tenantData) {
    // Si no se encuentra el tenant, retornar error
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
          Organización no encontrada
        </div>
      </div>
    );
  }

  tenantId = tenantData.id;
  tenantTimezone = tenantData.timezone || "Europe/Madrid";

  // P1.2: Cargar servicios usando tenant_id
  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_min, price_cents, stripe_price_id")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name");

  let successAppointment: { id: string; status: string } | null = null;
  const appointmentId =
    typeof searchParams?.appointment === "string"
      ? searchParams?.appointment
      : Array.isArray(searchParams?.appointment)
      ? searchParams?.appointment[0]
      : undefined;

  const success = searchParams?.success === "1";

  if (success && appointmentId) {
    // P1.2: Buscar en appointments (legacy) o bookings (nuevo)
    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (appointment) {
      successAppointment = appointment;
    } else {
      // Intentar en bookings
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("id", appointmentId)
        .maybeSingle();

      if (booking) {
        successAppointment = {
          id: booking.id,
          status: booking.status === "paid" ? "confirmed" : booking.status,
        };
      }
    }
  }

  const publicServices = (services ?? []) as PublicService[];

  return (
    <ReserveClient
      orgId={tenantId}
      services={publicServices}
      successAppointment={successAppointment}
      tenantTimezone={tenantTimezone}
    />
  );
}

