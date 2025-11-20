import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

// GET /api/availability/combined?tenantId=<uuid|slug>&day=YYYY-MM-DD
export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const tenantId = url.searchParams.get("tenantId");
		const day = url.searchParams.get("day");

		if (!tenantId || !day) {
			return NextResponse.json(
				{ error: "Faltan parámetros: tenantId y day (YYYY-MM-DD) son requeridos" },
				{ status: 400 }
			);
		}

		// Resolución de tenant: permitir UUID directo o slug
		const supabase = getSupabaseServer();
		let resolvedTenantId: string | null = null;

		// Intentar por UUID
		let { data: tenantById, error: tenantIdError } = await supabase
			.from("tenants")
			.select("id")
			.eq("id", tenantId)
			.maybeSingle();

		if (tenantById?.id) {
			resolvedTenantId = tenantById.id;
		} else {
			// Intentar por slug
			const { data: tenantBySlug, error: tenantSlugError } = await supabase
				.from("tenants")
				.select("id")
				.eq("slug", tenantId)
				.maybeSingle();
			if (tenantBySlug?.id) {
				resolvedTenantId = tenantBySlug.id;
			} else {
				const reason = tenantIdError?.message || tenantSlugError?.message || "Tenant no encontrado";
				return NextResponse.json({ error: reason }, { status: 404 });
			}
		}

		// Invocar RPC agregada
		const { data, error } = await supabase.rpc("get_public_services_with_slots", {
			p_tenant_id: resolvedTenantId,
			p_day: day,
		});

		if (error) {
			return NextResponse.json({ error: error.message, details: error.details }, { status: 500 });
		}

		return NextResponse.json(
			{
				tenantId: resolvedTenantId,
				day,
				services: data ?? [],
			},
			{ status: 200 }
		);
	} catch (err: any) {
		return NextResponse.json(
			{ error: "Error inesperado", details: err?.message || String(err) },
			{ status: 500 }
		);
	}
}









