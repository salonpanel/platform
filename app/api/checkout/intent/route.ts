import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type CheckoutIntentRequest = {
  tenant_id: string;
  service_id: string;
  customer_id?: string;
  staff_id?: string;
  starts_at: string; // ISO timestamp
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
};

/**
 * POST /api/checkout/intent
 * Crea un payment_intent (mock) para una reserva
 * 
 * Body:
 * - tenant_id: UUID del tenant (requerido)
 * - service_id: UUID del servicio (requerido)
 * - customer_id: UUID del cliente (opcional, se crea si no existe)
 * - staff_id: UUID del staff (opcional)
 * - starts_at: ISO timestamp de inicio (requerido)
 * - customer_email: Email del cliente (opcional, requerido si no hay customer_id)
 * - customer_name: Nombre del cliente (opcional, requerido si no hay customer_id)
 * - customer_phone: Teléfono del cliente (opcional)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutIntentRequest;
    const {
      tenant_id,
      service_id,
      customer_id,
      staff_id,
      starts_at,
      customer_email,
      customer_name,
      customer_phone,
    } = body;

    if (!tenant_id || !service_id || !starts_at) {
      return NextResponse.json(
        { error: "tenant_id, service_id y starts_at son requeridos" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // P1.3: Validar que el servicio existe, pertenece al tenant y tiene price_id
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, tenant_id, duration_min, price_cents, active, stripe_price_id")
      .eq("id", service_id)
      .eq("tenant_id", tenant_id)
      .eq("active", true)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Servicio no encontrado o inactivo" },
        { status: 404 }
      );
    }

    // P1.3: Validar que el servicio tiene price_id (es vendible)
    if (!service.stripe_price_id) {
      return NextResponse.json(
        { 
          error: "Servicio no vendible. El servicio no tiene un precio configurado en Stripe. Por favor, sincroniza el servicio con Stripe primero.",
          code: "MISSING_PRICE_ID"
        },
        { status: 422 }
      );
    }

    // Validar que la fecha es futura
    const startsAtDate = new Date(starts_at);
    if (startsAtDate <= new Date()) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser futura" },
        { status: 400 }
      );
    }

    // Calcular ends_at
    const endsAtDate = new Date(startsAtDate);
    endsAtDate.setMinutes(endsAtDate.getMinutes() + service.duration_min);

    // Obtener staff_id (puede venir del parámetro o necesitamos asignarlo después)
    let finalStaffId = staff_id || null;

    // Validar staff si se proporciona
    if (finalStaffId) {
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("id, tenant_id, active")
        .eq("id", finalStaffId)
        .eq("tenant_id", tenant_id)
        .eq("active", true)
        .maybeSingle();

      if (staffError || !staff) {
        return NextResponse.json(
          { error: "Staff no encontrado o inactivo" },
          { status: 404 }
        );
      }
    }

    // Obtener o crear customer
    let finalCustomerId = customer_id;
    if (!finalCustomerId) {
      if (!customer_email && !customer_name) {
        return NextResponse.json(
          { error: "customer_id o customer_email/name son requeridos" },
          { status: 400 }
        );
      }

      // Buscar customer existente por email
      if (customer_email) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("email", customer_email)
          .maybeSingle();

        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        }
      }

      // Crear customer si no existe
      if (!finalCustomerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert([
            {
              tenant_id,
              email: customer_email || null,
              name: customer_name || "Cliente",
              phone: customer_phone || null,
            },
          ])
          .select("id")
          .single();

        if (customerError || !newCustomer) {
          return NextResponse.json(
            { error: "Error al crear cliente: " + (customerError?.message || "Unknown") },
            { status: 500 }
          );
        }

        finalCustomerId = newCustomer.id;
      }
    }

    // Verificar que no hay conflicto de disponibilidad
    // Si hay staff_id, verificar conflicto específico con ese staff
    // Nota: La verificación de solapes se hace mejor en el endpoint de confirm
    // porque aquí aún no tenemos el staff_id final si no se proporciona

    // Crear payment_intent (mock)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // TTL de 15 minutos

    const { data: paymentIntent, error: intentError } = await supabase
      .from("payment_intents")
      .insert([
        {
          tenant_id,
          customer_id: finalCustomerId,
          service_id,
          amount_cents: service.price_cents,
          status: "requires_payment",
          payment_provider: "mock",
          metadata: {
            staff_id: staff_id || null,
            starts_at: starts_at,
            ends_at: endsAtDate.toISOString(),
          },
          expires_at: expiresAt.toISOString(),
        },
      ])
      .select("id, status, amount_cents, expires_at")
      .single();

    if (intentError || !paymentIntent) {
      return NextResponse.json(
        { error: "Error al crear payment_intent: " + (intentError?.message || "Unknown") },
        { status: 500 }
      );
    }

    // Crear log
    await supabase.rpc("create_log", {
      p_tenant_id: tenant_id,
      p_user_id: null,
      p_action: "payment_intent_created",
      p_resource_type: "payment_intent",
      p_resource_id: paymentIntent.id,
      p_metadata: { service_id, staff_id, starts_at },
    });

    return NextResponse.json({
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
      amount_cents: paymentIntent.amount_cents,
      expires_at: paymentIntent.expires_at,
    });
  } catch (err: any) {
    console.error("Error en checkout/intent:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

