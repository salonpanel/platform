import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase";
import { processStripeEvent } from "@/lib/stripe-handlers";
import type { WebhookHandlerContext } from "@/lib/stripe-handlers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 * 
 * Endpoint para recibir webhooks de Stripe
 * 
 * Características:
 * - Valida firma del webhook usando STRIPE_WEBHOOK_SECRET
 * - Soporta Stripe Connect Standard (Accounts v1)
 * - Idempotencia mediante tabla stripe_events_processed
 * - Handlers modulares por tipo de evento
 * - Siempre retorna 200 (incluso para eventos no soportados)
 */
export async function POST(req: Request) {
  // Leer body como raw buffer (Next.js App Router ya lo hace automáticamente)
  const bodyBuffer = Buffer.from(await req.arrayBuffer());
  const headersList = await headers();
  const signature = headersList.get("stripe-signature") ?? "";

  // Obtener webhook secret de variables de entorno
  // En producción: NO permitir fallback, debe estar configurado
  // En desarrollo: permitir fallback para testing local
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("stripe:webhook_secret_missing", {
        environment: "production",
        message: "STRIPE_WEBHOOK_SECRET no configurado en producción",
      });
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET no configurado." },
        { status: 500 }
      );
    }
    // Desarrollo: usar secret de test como fallback
    webhookSecret = "whsec_IumW21gqZsqahT0zvkQuQoxFeNuuJfSx";
    console.warn("stripe:webhook_secret_fallback", {
      environment: "development",
      message: "Usando secret de test como fallback",
    });
  }

  // Validar firma del webhook
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(bodyBuffer, signature, webhookSecret);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("stripe:signature_invalid", {
      error: errorMessage,
    });
    return NextResponse.json(
      { error: `Firma inválida: ${errorMessage}` },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const eventId = event.id;
  const eventType = event.type;

  // Log defensivo: información del evento antes de procesar
  const connectedAccountId: string | undefined =
    typeof event.account === "string" 
      ? event.account 
      : (event.account && typeof event.account === "object" && "id" in event.account)
        ? (event.account as { id: string }).id
        : undefined;
  
  console.info("stripe:event", {
    type: eventType,
    id: eventId,
    account: connectedAccountId || null,
  });

  // Idempotencia: Insertar evento ANTES de procesar
  // Si el evento ya existe (23505), retornar 200 sin procesar
  const { data: inserted, error: insertError } = await supabase
    .from("stripe_events_processed")
    .insert({ event_id: eventId, event_type: eventType })
    .select()
    .maybeSingle();

  if (insertError) {
    // Si es unique violation (23505), el evento ya fue procesado
    if (insertError.code === "23505") {
      console.info("stripe:duplicate", {
        type: eventType,
        eventId,
        deduped: true,
      });
      // Responder 200 para que Stripe no reintente
      return NextResponse.json({ ok: true, deduped: true });
    }

    // Otro error: loguear estructurado y retornar 500
    console.error("stripe:insert_error", {
      type: eventType,
      eventId,
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return NextResponse.json(
      { error: "Error registrando evento." },
      { status: 500 }
    );
  }

  // Si no se insertó (por alguna razón), también retornar 200 sin efectos
  if (!inserted) {
    console.warn("stripe:no_insert", {
      type: eventType,
      eventId,
    });
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Evento nuevo registrado correctamente → procesar
  // (connectedAccountId ya se obtuvo arriba para el log)

  // Crear contexto para el handler
  const context: WebhookHandlerContext = {
    event,
    stripe,
    supabase,
    connectedAccountId,
  };

  // Procesar evento usando handlers modulares
  const result = await processStripeEvent(context);

  // Logging mínimo sin payload sensible
  if (result.success) {
    console.info("stripe:processed", {
      type: eventType,
      eventId,
      connectedAccountId: connectedAccountId || null,
    });
  } else {
    console.error("stripe:handler_error", {
      type: eventType,
      eventId,
      message: result.message,
      error: result.error?.message,
      connectedAccountId: connectedAccountId || null,
    });
  }

  // Siempre retornar 200, incluso si hay errores
  // Stripe reintentará si no recibe 200, pero nosotros ya registramos el evento
  // Los errores se loguean pero no bloquean la respuesta
  return NextResponse.json({
    ok: true,
    processed: result.success,
    message: result.message,
  });
}
