import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type PublicTenantProfile = {
    id: string;
    name: string;
    slug: string;
    public_subdomain: string | null;
    settings: {
        brand_color?: string;
        logo_url?: string;
        theme?: "light" | "dark";
        currency?: string;
    };
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
            .select("id, name, slug, public_subdomain, settings, is_active")
            .or(`slug.eq.${slug},public_subdomain.eq.${slug}`)
            .maybeSingle();

        if (error) {
            console.error("[getPublicTenant] Error fetching tenant:", error);
            return null;
        }

        if (!data) return null;

        // Normalize settings
        const settings = (data.settings as any) || {};

        return {
            id: data.id,
            name: data.name,
            slug: data.slug,
            public_subdomain: data.public_subdomain,
            settings: {
                brand_color: settings.brand_color || "#0f172a", // Default Slate-900
                logo_url: settings.logo_url || null,
                theme: settings.theme || "light",
                currency: settings.currency || "EUR",
            },
            is_active: data.is_active ?? true, // Default to true if column missing
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
