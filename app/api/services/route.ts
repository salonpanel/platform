import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "@/lib/supabase";
import { hasTenantPermission } from "@/lib/permissions/server";

export const runtime = "nodejs";

type PricingLevelsPayload = {
  standard?: number | null;
  junior?: number | null;
  senior?: number | null;
  master?: number | null;
};

type CreateServiceRequest = {
  tenant_id?: string;
  name?: string;
  duration_min?: number;
  buffer_min?: number;
  price_cents?: number;
  active?: boolean;
  category?: string;
  pricing_levels?: PricingLevelsPayload | null;
};

/**
 * POST /api/services
 * Crea un nuevo servicio para un tenant
 * 
 * Body:
 * - tenant_id: UUID del tenant (requerido)
 * - name: Nombre del servicio (requerido)
 * - duration_min: Duración en minutos (requerido)
 * - price_cents: Precio en céntimos (requerido)
 * 
 * Nota: Este endpoint crea el servicio pero NO lo sincroniza con Stripe automáticamente.
 * Para sincronizar con Stripe, usar /api/payments/services/sync
 */
export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CreateServiceRequest;
    const {
      tenant_id,
      name,
      duration_min,
      buffer_min,
      price_cents,
      active,
      category,
      pricing_levels,
    } = payload;
    const trimmedName = name?.trim();

    if (
      !tenant_id ||
      !trimmedName ||
      duration_min == null ||
      price_cents == null
    ) {
      return NextResponse.json(
        { error: "tenant_id, name, duration_min y price_cents son obligatorios." },
        { status: 400 }
      );
    }

    if (duration_min < 5) {
      return NextResponse.json(
        { error: "La duración mínima es de 5 minutos." },
        { status: 400 }
      );
    }

    if (buffer_min != null && buffer_min < 0) {
      return NextResponse.json(
        { error: "El buffer no puede ser negativo." },
        { status: 400 }
      );
    }

    if (price_cents < 0) {
      return NextResponse.json(
        { error: "El precio no puede ser negativo." },
        { status: 400 }
      );
    }

    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Verificar que el usuario tiene acceso al tenant y es owner/admin/manager
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No tienes acceso a este tenant." },
        { status: 403 }
      );
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      const allowed = await hasTenantPermission(
        supabase,
        session.user.id,
        tenant_id,
        "servicios"
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes permiso para gestionar servicios." },
          { status: 403 }
        );
      }
    }

    // Crear servicio sin sincronizar con Stripe (se puede hacer después)
    const { data, error } = await supabase
      .from("services")
      .insert([
        {
          tenant_id,
          name: trimmedName,
          duration_min,
          buffer_min: buffer_min ?? 0,
          price_cents,
          active: typeof active === "boolean" ? active : true,
          category: category ?? "Otros",
          pricing_levels: pricing_levels ?? null,
        },
      ])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear el servicio." },
      { status: 500 }
    );
  }
}
