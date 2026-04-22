import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PublicTenantProfile = {
    id: string;
    name: string;
    slug: string;
    public_subdomain: string | null;
    logo_url: string | null;
    primary_color: string | null;
    is_active: boolean;
};

/**
 * Resolves a tenant by slug for the Public PWA.
 * Uses Service Role to ensure reliable fetching of public configuration
 * regardless of RLS policies (simulating a 'System Read').
 */
export async function getPublicTenant(slug: string): Promise<PublicTenantProfile | null> {
    const supabase = getSupabaseAdmin();

    try {
        const { data, error } = await supabase
            .from("tenants")
            .select("id, name, slug, public_subdomain, logo_url, primary_color, is_active")
            .or(`slug.eq.${slug},public_subdomain.eq.${slug}`)
            .maybeSingle();

        if (error) {
            console.error("[getPublicTenant] Error fetching tenant:", error);
            return null;
        }

        if (!data) return null;

        return {
            id: (data as any).id,
            name: (data as any).name,
            slug: (data as any).slug,
            public_subdomain: (data as any).public_subdomain ?? null,
            logo_url: (data as any).logo_url ?? null,
            primary_color: (data as any).primary_color ?? "#4FA1D8",
            is_active: (data as any).is_active ?? true,
        };
    } catch (err) {
        console.error("[getPublicTenant] Critical Error:", err);
        return null;
    }
}

export type PublicService = {
    id: string;
    name: string;
    duration_min: number;
    price_cents: number;
    category: string | null;
    description: string | null;
    image_url: string | null;
};

/**
 * Fetches active services for a tenant using the secure RPC.
 */
export async function getPublicServices(tenantId: string): Promise<PublicService[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .rpc("get_public_services_v1", { target_tenant_id: tenantId });

    if (error) {
        console.error("[getPublicServices] RPC Error:", error);
        return [];
    }

    return data || [];
}

export type TimeSlot = {
    slot_time: string;
    available: boolean;
};

/**
 * Fetches available slots for a service on a specific date.
 */
export async function getPublicAvailability(
    tenantId: string,
    serviceId: string,
    date: Date
): Promise<TimeSlot[]> {
    const supabase = getSupabaseAdmin();

    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await supabase
        .rpc("get_public_availability_v1", {
            target_tenant_id: tenantId,
            service_id: serviceId,
            query_date: dateStr
        });

    if (error) {
        console.error("[getPublicAvailability] RPC Error:", error);
        return [];
    }

    return data || [];
}

/**
 * Creates a public guest booking.
 */
export async function createPublicBooking(payload: {
    tenantId: string;
    serviceId: string;
    slotTime: string; // ISO String
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
}): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .rpc("create_public_booking_v1", {
            target_tenant_id: payload.tenantId,
            service_id: payload.serviceId,
            slot_time: payload.slotTime,
            customer_email: payload.customerEmail,
            customer_name: payload.customerName,
            customer_phone: payload.customerPhone || null
        });

    if (error) {
        console.error("[createPublicBooking] RPC Error:", error);
        return { success: false, error: "No se pudo crear la reserva." };
    }

    return { success: true, bookingId: data };
}
