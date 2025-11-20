import { supabaseServer } from "@/lib/supabase";
import { ReserveClient, PublicService, PublicServiceWithSlots } from "./ReserveClient";
import { format } from "date-fns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: { orgId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};

export const dynamic = "force-dynamic";

// Metadatos SEO para el portal público de reservas
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = supabaseServer();
  
  // Intentar obtener el nombre del tenant para personalizar el título
  let tenantName = "Barbería";
  try {
    // Intentar primero por ID (UUID)
    const { data: tenantById } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", params.orgId)
      .maybeSingle();
    
    // Si no se encuentra por ID, intentar por slug
    if (!tenantById) {
      const { data: tenantBySlug } = await supabase
        .from("tenants")
        .select("name")
        .eq("slug", params.orgId)
        .maybeSingle();
      
      if (tenantBySlug) {
        tenantName = tenantBySlug.name;
      }
    } else {
      tenantName = tenantById.name;
    }
  } catch (error) {
    // Si falla, usar el nombre genérico
    console.error("Error obteniendo nombre del tenant para metadata:", error);
  }

  return {
    title: `${tenantName} - Reserva tu cita online | BookFast`,
    description: `Reserva tu cita en ${tenantName} de forma rápida y sencilla. Elige servicio, fecha y hora.`,
    robots: {
      index: true, // El portal público SÍ debe ser indexado
      follow: true,
    },
    openGraph: {
      title: `${tenantName} - Reserva tu cita online`,
      description: `Reserva tu cita en ${tenantName} de forma rápida y sencilla.`,
      type: "website",
    },
  };
}

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
    // Si no se encuentra el tenant, usar notFound() de Next.js
    // Esto mostrará app/not-found.tsx o app/r/[orgId]/not-found.tsx si existe
    notFound();
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

  if (!tenantId) {
    notFound();
  }

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

