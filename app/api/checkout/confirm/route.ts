import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { holdRateLimit, getClientIp } from "@/lib/rate-limit";

type CheckoutConfirmRequest = {
  payment_intent_id: string;
  mock_payment?: boolean; // Para simular pago (default: true en desarrollo)
};

/**
 * POST /api/checkout/confirm
 * Confirma un payment_intent y crea el booking
 * 
 * SEGURIDAD: Rate limiting activo. El tenant_id se deriva del payment_intent, no del cliente.
 * 
 * Body:
 * - payment_intent_id: UUID del payment_intent (requerido)
 * - mock_payment: Boolean para simular pago (opcional, default: true)
 * 
 * Protección:
 * - Rate limiting: 50 req/10min por IP
 * - Validación estricta: tenant_id se deriva del payment_intent
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    if (holdRateLimit) {
      const { success, reset } = await holdRateLimit.limit(`checkout:confirm:${ip}`);
      if (!success) {
        return NextResponse.json(
          { 
            error: "Se han realizado demasiadas solicitudes. Inténtalo más tarde.",
            code: "RATE_LIMIT"
          },
          { status: 429 }
        );
      }
    }

    const body = (await req.json()) as CheckoutConfirmRequest;
    const { payment_intent_id, mock_payment = true } = body;

    if (!payment_intent_id) {
      return NextResponse.json(
        { error: "payment_intent_id es requerido" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Obtener payment_intent
    const { data: paymentIntent, error: intentError } = await supabase
      .from("payment_intents")
      .select("*")
      .eq("id", payment_intent_id)
      .maybeSingle();

    if (intentError || !paymentIntent) {
      return NextResponse.json(
        { error: "Payment intent no encontrado" },
        { status: 404 }
      );
    }

    // Validar estado
    if (paymentIntent.status !== "requires_payment") {
      return NextResponse.json(
        { error: `Payment intent ya procesado (status: ${paymentIntent.status})` },
        { status: 400 }
      );
    }

    // Validar expiración
    if (paymentIntent.expires_at && new Date(paymentIntent.expires_at) <= new Date()) {
      // Marcar como expirado
      await supabase
        .from("payment_intents")
        .update({ status: "cancelled" })
        .eq("id", payment_intent_id);

      return NextResponse.json(
        { error: "Payment intent expirado" },
        { status: 400 }
      );
    }

    // Simular pago (mock)
    if (mock_payment) {
      // En producción, aquí se validaría con el proveedor de pago real (Stripe, etc.)
      // Por ahora, simulamos que el pago es exitoso
    }

    // Actualizar payment_intent a paid
    const { error: updateError } = await supabase
      .from("payment_intents")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment_intent_id);

    if (updateError) {
      return NextResponse.json(
        { error: "Error al actualizar payment_intent: " + updateError.message },
        { status: 500 }
      );
    }

    // Validar que el servicio existe y está activo
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, tenant_id, duration_min, active, staff_only_ids")
      .eq("id", paymentIntent.service_id)
      .eq("tenant_id", paymentIntent.tenant_id)
      .eq("active", true)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Servicio no encontrado o inactivo" },
        { status: 404 }
      );
    }

    // Extraer datos del metadata
    const metadata = paymentIntent.metadata as any;
    const startsAt = metadata?.starts_at || new Date().toISOString();
    const staffId = metadata?.staff_id || null;

    // Calcular ends_at
    const startsAtDate = new Date(startsAt);
    const endsAtDate = new Date(startsAtDate);
    endsAtDate.setMinutes(endsAtDate.getMinutes() + service.duration_min);

    // Si no hay staff_id, necesitamos seleccionar uno disponible
    // Por ahora, si no hay staff_id, usamos el primero disponible del tenant
    let finalStaffId = staffId;
    if (!finalStaffId) {
      const { data: availableStaff } = await supabase
        .from("staff")
        .select("id")
        .eq("tenant_id", paymentIntent.tenant_id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      if (availableStaff) {
        finalStaffId = availableStaff.id;
      } else {
        return NextResponse.json(
          { error: "No hay staff disponible" },
          { status: 400 }
        );
      }
    }

    // Validar staff_only_ids: si existe restricción, verificar que el staff está permitido
    if (service.staff_only_ids && service.staff_only_ids.length > 0) {
      if (!finalStaffId || !service.staff_only_ids.includes(finalStaffId)) {
        return NextResponse.json(
          { error: "El staff seleccionado no puede prestar este servicio" },
          { status: 400 }
        );
      }
    }

    // Verificar disponibilidad (opcional, la constraint de BD lo evitará)
    // Pero verificamos antes para dar mejor mensaje de error
    const { data: isAvailable, error: availabilityError } = await supabase.rpc(
      "check_staff_availability",
      {
        p_staff_id: finalStaffId,
        p_starts_at: startsAt,
        p_ends_at: endsAtDate.toISOString(),
      }
    );

    if (availabilityError) {
      console.error("Error al verificar disponibilidad:", availabilityError);
      // Continuar de todas formas, la constraint de BD lo evitará
    }

    if (isAvailable === false) {
      // Marcar payment_intent como failed
      await supabase
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("id", payment_intent_id);

      return NextResponse.json(
        { error: "El slot seleccionado ya está ocupado" },
        { status: 409 }
      );
    }

    // Crear booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([
        {
          tenant_id: paymentIntent.tenant_id,
          customer_id: paymentIntent.customer_id,
          staff_id: finalStaffId,
          service_id: paymentIntent.service_id,
          starts_at: startsAt,
          ends_at: endsAtDate.toISOString(),
          status: "paid",
          payment_intent_id: paymentIntent.id,
        },
      ])
      .select("*")
      .single();

    if (bookingError || !booking) {
      // Manejar error 23P01 (exclusion violation = solape)
      if (bookingError?.code === "23P01") {
        // Marcar payment_intent como failed
        await supabase
          .from("payment_intents")
          .update({ status: "failed" })
          .eq("id", payment_intent_id);

        return NextResponse.json(
          { error: "El slot seleccionado ya está ocupado", code: "23P01" },
          { status: 409 }
        );
      }

      // Otro error
      // Marcar payment_intent como failed
      await supabase
        .from("payment_intents")
        .update({ status: "failed" })
        .eq("id", payment_intent_id);

      console.error("Error al crear booking:", bookingError);
      return NextResponse.json(
        { error: "Error al crear booking: " + (bookingError?.message || "Unknown") },
        { status: 500 }
      );
    }

    // Crear log
    await supabase.rpc("create_log", {
      p_tenant_id: paymentIntent.tenant_id,
      p_user_id: null,
      p_action: "booking_created",
      p_resource_type: "booking",
      p_resource_id: booking.id,
      p_metadata: {
        payment_intent_id: paymentIntent.id,
        service_id: paymentIntent.service_id,
        staff_id: finalStaffId,
      },
    });

    return NextResponse.json({
      booking_id: booking.id,
      status: booking.status,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      payment_intent_id: paymentIntent.id,
    });
  } catch (err: any) {
    console.error("Error en checkout/confirm:", err);
    return NextResponse.json(
      { error: err?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}

