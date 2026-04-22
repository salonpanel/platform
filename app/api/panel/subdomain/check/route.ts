import { NextRequest, NextResponse } from "next/server";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isValidTenantSlug, isReservedSubdomain } from "@/lib/domains";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/panel/subdomain/check?slug=xxx&tenant_id=yyy
 *
 * Comprueba si un subdominio está disponible para el tenant indicado.
 * - Valida formato (solo lowercase, nums, guiones, 3-32 chars)
 * - Verifica que no sea reservado
 * - Verifica que no esté en uso por otro tenant
 *
 * Returns: { available: boolean, error?: string }
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const slug = searchParams.get("slug")?.toLowerCase().trim() ?? "";
    const tenantId = searchParams.get("tenant_id") ?? "";

    // 1. Validar formato
    if (!slug) {
        return NextResponse.json({ available: false, error: "Introduce un subdominio" });
    }

    if (isReservedSubdomain(slug)) {
        return NextResponse.json({ available: false, error: "Este subdominio está reservado por la plataforma" });
    }

    if (!isValidTenantSlug(slug)) {
        return NextResponse.json({
            available: false,
            error: "Solo letras minúsculas, números y guiones (3-32 caracteres)",
        });
    }

    // 2. Comprobar disponibilidad en DB
    try {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("tenants")
            .select("id")
            .or(`slug.eq.${slug},public_subdomain.eq.${slug}`)
            .maybeSingle();

        if (error) {
            console.error("[subdomain/check] DB error:", error);
            return NextResponse.json({ available: false, error: "Error al verificar disponibilidad" });
        }

        // Si existe pero pertenece al mismo tenant, es válido (no cambia nada)
        if (data && tenantId && data.id === tenantId) {
            return NextResponse.json({ available: true });
        }

        // Si existe y es otro tenant, no disponible
        if (data) {
            return NextResponse.json({ available: false, error: "Este subdominio ya está en uso" });
        }

        return NextResponse.json({ available: true });
    } catch (err) {
        console.error("[subdomain/check] error:", err);
        return NextResponse.json({ available: false, error: "Error interno" });
    }
}
