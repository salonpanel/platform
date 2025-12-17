import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";
import { hasTenantPermission } from "@/lib/permissions/server";
import { assertMembership } from "@/lib/server/assertMembership";

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

    const supabaseAuth = await createClientForServer();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // Llamar a assertMembership
    const membership = await assertMembership(supabaseServer(), session.user.id, tenant_id);

    // Verificar permisos adicionales
    if (membership.role !== "owner" && membership.role !== "admin") {
      const allowed = await hasTenantPermission(
        supabaseServer(),
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
    const supabase = supabaseServer();
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
      console.error("[ServicesAPI] Error creating service:", {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        payload: {
          tenant_id,
          name: trimmedName,
          duration_min,
          buffer_min: buffer_min ?? 0,
          price_cents,
          active: typeof active === "boolean" ? active : true,
          category: category ?? "Otros",
          pricing_levels: pricing_levels ?? null,
        }
      });
      return NextResponse.json(
        { error: "Supabase error", details: error },
        { status: 500 }
      );
    }

    console.log("[ServicesAPI] Service created successfully:", data.id);
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear el servicio." },
      { status: 500 }
    );
  }
}
