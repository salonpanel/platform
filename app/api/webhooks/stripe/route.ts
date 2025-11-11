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

  const { error: insertError } = await sb
    .from("stripe_events_processed")
    .insert({ event_id: eventId });

  if (insertError) {
    if (insertError.code === "23505") {
      console.info("stripe", { type: event.type, eventId, deduped: true });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: insertError.message ?? "Error registrando evento." },
      { status: 500 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointment_id;

    if (appointmentId) {
      const { data: appointment, error } = await sb
        .from("appointments")
        .select("id, status, expires_at")
        .eq("id", appointmentId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message ?? "Error consultando cita." },
          { status: 500 }
        );
      }

      if (appointment) {
        const now = new Date();
        const expiresAt = appointment.expires_at
          ? new Date(appointment.expires_at)
          : null;

        const isExpired = expiresAt ? expiresAt <= now : false;
        const alreadyConfirmed = appointment.status === "confirmed";

        if (!alreadyConfirmed && !isExpired) {
          const { error: updateError } = await sb
            .from("appointments")
            .update({ status: "confirmed", expires_at: null })
            .eq("id", appointmentId);

          if (updateError) {
            return NextResponse.json(
              { error: updateError.message ?? "Error actualizando cita." },
              { status: 500 }
            );
          }
        }
      }
    }
  }

  console.info("stripe", { type: event.type, eventId });
  return NextResponse.json({ ok: true });
}
