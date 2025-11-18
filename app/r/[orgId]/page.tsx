import { supabaseServer } from "@/lib/supabase";
import { ReserveClient, PublicService, PublicServiceWithSlots } from "./ReserveClient";
import { format } from "date-fns";

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="glass rounded-2xl border border-red-500/50 bg-red-500/10 p-8 text-center max-w-md shadow-[0px_12px_48px_rgba(0,0,0,0.5)]">
          <h1 className="text-2xl font-bold text-red-400 mb-2 font-satoshi">Organización no encontrada</h1>
          <p className="text-slate-400">La organización que buscas no existe o no está disponible.</p>
        </div>
      </div>
    );
  }

  tenantId = tenantData.id;
  tenantTimezone = tenantData.timezone || "Europe/Madrid";

  // P1.2: Cargar servicios + slots del portal con RPC combinado vía endpoint interno
  const dayParam =
    typeof searchParams?.day === "string"
      ? searchParams?.day
      : Array.isArray(searchParams?.day)
      ? searchParams?.day[0]
      : format(new Date(), "yyyy-MM-dd");

  // Importante: usar fetch relativo (SSR) para pasar por el route handler
  const combinedRes = await fetch(
    `/api/availability/combined?tenantId=${encodeURIComponent(params.orgId)}&day=${encodeURIComponent(dayParam)}`,
    { cache: "no-store" }
  );

  let services: PublicService[] = [];
  let servicesWithSlots: PublicServiceWithSlots[] = [];

  if (combinedRes.ok) {
    const combined = await combinedRes.json();
    const arr = Array.isArray(combined?.services) ? combined.services : [];
    // Mapear a tipos locales
    services = arr.map((s: any) => ({
      id: s.id,
      name: s.name,
      duration_min: s.duration_min,
      price_cents: s.price_cents,
      stripe_price_id: s.stripe_price_id ?? null,
    }));
    servicesWithSlots = arr.map((s: any) => ({
      id: s.id,
      name: s.name,
      duration_min: s.duration_min,
      price_cents: s.price_cents,
      stripe_price_id: s.stripe_price_id ?? null,
      slots: Array.isArray(s.slots) ? s.slots : [],
    }));
  } else {
    // Fallback: servicios simples sin slots si el endpoint fallara
    const { data: servicesData } = await supabase
      .from("services")
      .select("id, name, duration_min, price_cents, stripe_price_id")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("name");
    services = (servicesData ?? []) as PublicService[];
    servicesWithSlots = services.map(s => ({ ...s, slots: [] }));
  }

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
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (appointment) {
      successAppointment = appointment;
    } else {
      // Intentar en bookings
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("id", appointmentId)
        .eq("tenant_id", tenantId)
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
      servicesWithSlots={servicesWithSlots}
      successAppointment={successAppointment}
      tenantTimezone={tenantTimezone}
    />
  );
}

