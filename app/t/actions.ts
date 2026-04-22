"use server";

import { headers } from "next/headers";
import { computeAvailableSlots } from "@/lib/availability";
import { createPublicBooking } from "@/lib/tenant/public-api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function fetchAvailabilityAction(
  tenantId: string,
  serviceId: string,
  dateIso: string,
) {
  const date = new Date(dateIso);
  const supabase = getSupabaseAdmin();

  const { data: staffMembers } = await supabase
    .from("staff")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (!staffMembers || staffMembers.length === 0) return [];

  const allSlots: { slot_time: string; available: boolean }[] = [];
  const slotSet = new Set<string>();

  for (const staff of staffMembers) {
    const slots = await computeAvailableSlots(staff.id, serviceId, date, supabase);
    slots.forEach((s) => {
      const timeStr = s.start_time.toISOString();
      if (!slotSet.has(timeStr)) {
        slotSet.add(timeStr);
        allSlots.push({ slot_time: timeStr, available: true });
      }
    });
  }

  return allSlots.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
}

export async function submitBookingAction(formData: {
  tenantId: string;
  serviceId: string;
  slotTime: string;
  name: string;
  email: string;
  phone: string;
}) {
  return await createPublicBooking({
    tenantId: formData.tenantId,
    serviceId: formData.serviceId,
    slotTime: formData.slotTime,
    customerName: formData.name,
    customerEmail: formData.email,
    customerPhone: formData.phone,
  });
}

export async function createCheckoutSessionAction(bookingId: string) {
  const supabase = getSupabaseAdmin();
  const headersList = await headers();
  const origin =
    headersList.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bookfast.es";

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `
        id,
        tenant_id,
        service_id,
        service:services(id, name, price_cents, duration_min),
        customer:customers(email, full_name)
      `,
    )
    .eq("id", bookingId)
    .single();

  if (error || !booking) throw new Error("Reserva no encontrada");

  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: tenant } = await adminClient
    .from("tenants")
    .select("stripe_account_id, name")
    .eq("id", booking.tenant_id)
    .single();

  if (!tenant?.stripe_account_id) {
    throw new Error("El comercio no tiene pagos configurados (Stripe Connect).");
  }

  const stripe = (await import("@/lib/stripe")).stripe;

  const service: any = Array.isArray((booking as any).service)
    ? (booking as any).service[0]
    : (booking as any).service;
  const customer: any = Array.isArray((booking as any).customer)
    ? (booking as any).customer[0]
    : (booking as any).customer;

  const unitAmount = service?.price_cents ?? 0;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customer?.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Reserva: ${service?.name}`,
            description: `${service?.duration_min} min en ${tenant.name}`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: 0,
      transfer_data: { destination: tenant.stripe_account_id },
    },
    metadata: {
      booking_id: bookingId,
      tenant_id: booking.tenant_id,
      service_id: service?.id || booking.service_id,
    },
    success_url: `${origin}/mis-citas?status=success`,
    cancel_url: `${origin}/mis-citas?status=cancelled`,
  });

  return { url: session.url };
}

