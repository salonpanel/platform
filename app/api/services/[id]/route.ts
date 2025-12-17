import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { stripe } from "@/lib/stripe";
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

type UpdateServiceRequest = {
  active?: boolean;
  name?: string;
  duration_min?: number;
  buffer_min?: number;
  price_cents?: number;
  category?: string;
  pricing_levels?: PricingLevelsPayload | null;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/services/[id]
 * Actualiza un servicio existente
 * 
 * Body:
 * - active: boolean (opcional)
 * - name: string (opcional)
 * - duration_min: number (opcional)
 * - price_cents: number (opcional)
 * 
 * Nota: Si el servicio tiene stripe_product_id, también se actualiza en Stripe
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido." }, { status: 400 });
    }

    const payload = (await req.json()) as UpdateServiceRequest;

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((cookie) => {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            });
          },
        },
        // Importante: usar el mismo nombre de cookie que el cliente de navegador (sb-panel-auth)
        cookieOptions: {
          name: "sb-panel-auth",
          path: "/",
        },
      }
    );
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const supabase = supabaseServer();

    // Obtener servicio y verificar permisos
    const { data: service, error: fetchError } = await supabase
      .from("services")
      .select(
        "id, tenant_id, active, stripe_product_id, name, duration_min, buffer_min, price_cents, category, pricing_levels"
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[ServicesAPI] Error fetching service for PATCH:", {
        error: fetchError,
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint,
        serviceId: id,
      });
      return NextResponse.json(
        { error: "Supabase error", details: fetchError },
        { status: 500 }
      );
    }

    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    // Llamar a assertMembership con tenant_id del servicio
    const membership = await assertMembership(supabaseServer(), session.user.id, service.tenant_id);

    // Verificar permisos adicionales
    if (membership.role !== "owner" && membership.role !== "admin") {
      const allowed = await hasTenantPermission(
        supabase,
        session.user.id,
        service.tenant_id,
        "servicios"
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes permiso para gestionar servicios." },
          { status: 403 }
        );
      }
    }

    // Preparar actualización
    const updateData: any = {};
    if (typeof payload.active === "boolean") {
      updateData.active = payload.active;
    }
    if (payload.name !== undefined) {
      updateData.name = payload.name.trim();
    }
    if (payload.duration_min !== undefined) {
      if (payload.duration_min < 5) {
        return NextResponse.json(
          { error: "La duración mínima es de 5 minutos." },
          { status: 400 }
        );
      }
      updateData.duration_min = payload.duration_min;
    }
    if (payload.buffer_min !== undefined) {
      if (payload.buffer_min < 0) {
        return NextResponse.json(
          { error: "El buffer no puede ser negativo." },
          { status: 400 }
        );
      }
      updateData.buffer_min = payload.buffer_min;
    }
    if (payload.price_cents !== undefined) {
      if (payload.price_cents < 0) {
        return NextResponse.json(
          { error: "El precio no puede ser negativo." },
          { status: 400 }
        );
      }
      updateData.price_cents = payload.price_cents;
    }
    if (payload.category !== undefined) {
      updateData.category = payload.category || "Otros";
    }
    if (payload.pricing_levels !== undefined) {
      updateData.pricing_levels = payload.pricing_levels;
    }

    // Si hay cambios y el servicio tiene stripe_product_id, actualizar en Stripe
    if (Object.keys(updateData).length > 0 && service.stripe_product_id) {
      try {
        const stripeUpdate: any = {};
        if (updateData.active !== undefined) {
          stripeUpdate.active = updateData.active;
        }
        if (updateData.name !== undefined) {
          stripeUpdate.name = updateData.name;
        }
        
        if (Object.keys(stripeUpdate).length > 0) {
          await stripe.products.update(service.stripe_product_id, stripeUpdate);
        }
      } catch (stripeError: any) {
        console.warn("Error al actualizar en Stripe (no crítico):", stripeError);
        // Continuar con la actualización en DB aunque falle Stripe
      }
    }

    // Actualizar en base de datos
    const { data: updated, error: updateError } = await supabase
      .from("services")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[ServicesAPI] Error updating service:", {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        serviceId: id,
      });
      return NextResponse.json(
        { error: "Supabase error", details: updateError },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo actualizar el servicio." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((cookie) => {
              cookieStore.set(cookie.name, cookie.value, cookie.options);
            });
          },
        },
        // Usar mismo nombre de cookie que el cliente (sb-panel-auth)
        cookieOptions: {
          name: "sb-panel-auth",
          path: "/",
        },
      }
    );
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data: service, error: fetchError } = await supabase
      .from("services")
      .select("id, tenant_id, active")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("tenant_id", service.tenant_id)
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
        service.tenant_id,
        "servicios"
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes permiso para gestionar servicios." },
          { status: 403 }
        );
      }
    }

    const url = new URL(req.url);
    const hardDelete = url.searchParams.get("hard") === "true";

    if (hardDelete) {
      if (service.active) {
        return NextResponse.json(
          { error: "Solo puedes eliminar definitivamente servicios archivados." },
          { status: 400 }
        );
      }

      // Comprobar si existen reservas FUTURAS asociadas a este servicio
      const nowIso = new Date().toISOString();
      const { count: bookingsCount, error: bookingsError } = await supabase
        .from("bookings")
        .select("id", { head: true, count: "exact" })
        .eq("service_id", id)
        .gte("starts_at", nowIso);

      if (bookingsError) {
        console.error("[ServicesAPI] Error checking future bookings before hard delete:", {
          error: bookingsError,
          code: bookingsError.code,
          message: bookingsError.message,
          details: bookingsError.details,
          hint: bookingsError.hint,
          serviceId: id,
        });
        return NextResponse.json(
          {
            error: "Supabase error",
            details: bookingsError,
          },
          { status: 500 }
        );
      }

      if ((bookingsCount || 0) > 0) {
        return NextResponse.json(
          {
            error:
              "No puedes eliminar definitivamente este servicio porque tiene reservas futuras programadas. Mantén el servicio archivado hasta que no queden citas pendientes.",
          },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabase
        .from("services")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("[ServicesAPI] Error hard-deleting service:", {
          error: deleteError,
          code: deleteError.code,
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          serviceId: id,
        });
        return NextResponse.json(
          {
            error: "Supabase error",
            details: deleteError,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    const { data: updated, error: updateError } = await supabase
      .from("services")
      .update({ active: false })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo eliminar el servicio." },
      { status: 500 }
    );
  }
}

