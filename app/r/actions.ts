"use server";

import { createPublicBooking } from "@/lib/tenant/public-api";
import { computeAvailableSlots } from "@/lib/availability";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function fetchAvailabilityAction(tenantId: string, serviceId: string, dateIso: string) {
    const date = new Date(dateIso);
    const supabase = getSupabaseAdmin();

    // 1. Get Staff for this Tenant (Simplification: Get ALL staff for now, or those assigned to service)
    // Ideally we check service_assignments, but strict Phase 12.3 just needs "Real" availability.
    // Let's fetch all active staff.
    const { data: staffMembers } = await supabase
        .from("staff")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

    if (!staffMembers || staffMembers.length === 0) return [];

    const allSlots: { slot_time: string; available: boolean }[] = [];
    const slotSet = new Set<string>();

    // 2. Compute slots for each staff member using the Real Engine
    // This respects schedules, blockings, and buffers.
    for (const staff of staffMembers) {
        const slots = await computeAvailableSlots(staff.id, serviceId, date, supabase);

        slots.forEach(s => {
            const timeStr = s.start_time.toISOString();
            if (!slotSet.has(timeStr)) {
                slotSet.add(timeStr);
                allSlots.push({
                    slot_time: timeStr,
                    available: true
                });
            }
        });
    }

    // Sort chronologically
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

import { headers } from "next/headers";

export async function createCheckoutSessionAction(bookingId: string) {
    const supabase = getSupabaseAdmin();
    const headersList = await headers();
    const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://barberia.bookfast.es";

    // 1. Fetch Booking and Service details (Securely)
    // We need to fetch tenant_id to get stripe_account_id
    const { data: booking, error } = await supabase
        .from("bookings")
        .select(`
            id,
            tenant_id,
            service_id,
            service:services(id, name, price_cents, duration_min),
            customer:customers(email, full_name)
        `)
        .eq("id", bookingId)
        .single();

    if (error || !booking) {
        throw new Error("Reserva no encontrada");
    }

    // 2. Fetch Tenant Stripe Account ID (Requires Service Role if column is protected)
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tenant } = await adminClient
        .from("tenants")
        .select("stripe_account_id, name")
        .eq("id", booking.tenant_id)
        .single();

    if (!tenant?.stripe_account_id) {
        throw new Error("El comercio no tiene pagos configurados (Stripe Connect).");
    }

    // 3. Create Stripe Checkout Session
    const stripe = (await import("@/lib/stripe")).stripe;

    // Handle Supabase possibly returning arrays
    const service: any = Array.isArray(booking.service) ? booking.service[0] : booking.service;
    const customer: any = Array.isArray(booking.customer) ? booking.customer[0] : booking.customer;

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
            application_fee_amount: 0, // Platform fee (0 for now)
            transfer_data: {
                destination: tenant.stripe_account_id,
            },
        },
        metadata: {
            booking_id: bookingId,
            tenant_id: booking.tenant_id,
            service_id: service?.id || booking.service_id // Fallback
        },
        success_url: `${origin}/r/redirect?to=/mis-citas&status=success`,
        cancel_url: `${origin}/r/redirect?to=/mis-citas&status=cancelled`,
    });

    return { url: session.url };
}
