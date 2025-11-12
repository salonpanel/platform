import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  const bodyBuffer = Buffer.from(await req.arrayBuffer());
  const signature = headers().get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET no configurado." },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(bodyBuffer, signature, webhookSecret);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Firma inválida: ${error?.message ?? "desconocido"}` },
      { status: 400 }
    );
  }

  const sb = supabaseServer();
  const eventId = event.id;
  const eventType = event.type;

  // P0.1: Idempotencia - Insertar evento ANTES de procesar
  // Usar "insert ... on conflict do nothing" para cortar reintentos
  // Si conflicto (23505) => evento ya procesado => retornar 200 sin efectos
  const { data: inserted, error: insertError } = await sb
    .from("stripe_events_processed")
    .insert({ event_id: eventId, event_type: eventType })
    .select()
    .maybeSingle();

  // Manejar error de inserción
  if (insertError) {
    // Si es unique violation (23505), el evento ya fue procesado
    if (insertError.code === "23505") {
      // Short-circuit: retornar 200 sin procesar (idempotencia)
      // Logging mínimo: solo tipo e ID, sin payload sensible
      console.info("stripe:duplicate", { 
        type: eventType, 
        eventId, 
        deduped: true
      });
      // Responder 200 para que Stripe no reintente
      return NextResponse.json({ ok: true, deduped: true });
    }
    // Otro error: devolver error (no debería pasar)
    console.error("stripe:insert_error", { 
      type: eventType, 
      eventId, 
      code: insertError.code,
      message: insertError.message 
    });
    return NextResponse.json(
      { error: "Error registrando evento." },
      { status: 500 }
    );
  }

  // Si no se insertó (por alguna razón), también retornar 200 sin efectos
  // Esto puede pasar si el evento ya existe pero no detectamos el conflicto
  if (!inserted) {
    console.warn("stripe:no_insert", { 
      type: eventType, 
      eventId
    });
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Evento nuevo registrado correctamente → continuar con el procesamiento

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointment_id;
    const bookingId = session.metadata?.booking_id;
    const paymentIntentId = session.metadata?.payment_intent_id;

    // Procesar booking (nuevo modelo)
    if (bookingId || paymentIntentId) {
      // Si hay payment_intent_id, actualizar el payment_intent y confirmar booking
      if (paymentIntentId) {
        const { data: paymentIntent, error: piError } = await sb
          .from("payment_intents")
          .select("id, status, tenant_id, service_id, customer_id, metadata")
          .eq("id", paymentIntentId)
          .maybeSingle();

        if (!piError && paymentIntent && paymentIntent.status === "requires_payment") {
          // Actualizar payment_intent a paid
          await sb
            .from("payment_intents")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("id", paymentIntentId);

          // Buscar booking asociado
          const { data: booking } = await sb
            .from("bookings")
            .select("id, status")
            .eq("payment_intent_id", paymentIntentId)
            .maybeSingle();

          if (booking && booking.status === "pending") {
            // Actualizar booking a paid
            await sb
              .from("bookings")
              .update({ status: "paid", expires_at: null })
              .eq("id", booking.id);
          }
        }
      }

      // Si hay booking_id directo, confirmarlo
      if (bookingId) {
        const { data: booking, error: bookingError } = await sb
          .from("bookings")
          .select("id, status, expires_at")
          .eq("id", bookingId)
          .maybeSingle();

        if (!bookingError && booking) {
          const now = new Date();
          const expiresAt = booking.expires_at
            ? new Date(booking.expires_at)
            : null;

          const isExpired = expiresAt ? expiresAt <= now : false;
          const alreadyPaid = booking.status === "paid";

          if (!alreadyPaid && !isExpired) {
            await sb
              .from("bookings")
              .update({ status: "paid", expires_at: null })
              .eq("id", bookingId);
          }
        }
      }
    }

    // Procesar appointment (legacy, mantener compatibilidad)
    if (appointmentId) {
      const { data: appointment, error: appointmentError } = await sb
        .from("appointments")
        .select("id, status, expires_at")
        .eq("id", appointmentId)
        .maybeSingle();

      if (!appointmentError && appointment) {
        const now = new Date();
        const expiresAt = appointment.expires_at
          ? new Date(appointment.expires_at)
          : null;

        const isExpired = expiresAt ? expiresAt <= now : false;
        const alreadyConfirmed = appointment.status === "confirmed";

        if (!alreadyConfirmed && !isExpired) {
          await sb
            .from("appointments")
            .update({ status: "confirmed", expires_at: null })
            .eq("id", appointmentId);
        }
      }
    }
  }

  // P0.1: Logging mínimo sin payload sensible (solo tipo e ID, sin PII)
  // Sin customer_email, payment_intent_id, etc.
  console.info("stripe:processed", { 
    type: eventType, 
    eventId
  });
  
  return NextResponse.json({ ok: true });
}
