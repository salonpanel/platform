import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { holdRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { addMinutes, isBefore, parseISO } from "date-fns";
import { z } from "zod";

const HOLD_TTL_MINUTES = 10;

const HoldSchema = z.object({
  org_id: z.string().uuid(),
  service_id: z.string().uuid(),
  starts_at: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Formato de fecha no válido",
  }),
  captcha_token: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parseResult = HoldSchema.safeParse(json);

  if (!parseResult.success) {
    const message =
      parseResult.error.issues[0]?.message ??
      "Datos inválidos para crear la reserva.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { org_id, service_id, starts_at, captcha_token } = parseResult.data;
  const startsAt = parseISO(starts_at);

  const ip = getClientIp(req);

  // P0.2: Rate limit - 50 req/10min por IP (sliding window)
  if (holdRateLimit) {
    const { success, reset } = await holdRateLimit.limit(`hold:${ip}`);
    if (!success) {
      console.warn("hold:rate_limit", {
        ip,
        reset: reset ? new Date(reset).toISOString() : null
      });
      return NextResponse.json(
        { 
          error: "Se han realizado demasiadas solicitudes. Inténtalo más tarde.",
          code: "RATE_LIMIT"
        },
        { status: 429 }
      );
    }
  }

  const captchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  if (captchaSecret) {
    if (!captcha_token) {
      return NextResponse.json(
        { error: "Captcha requerido." },
        { status: 400 }
      );
    }
    const captcha = await verifyRecaptcha(
      captcha_token,
      ip !== "unknown" ? ip : undefined
    );

    if (!captcha.success || (captcha.score ?? 0) < 0.5) {
      return NextResponse.json(
        { error: "Verificación de captcha fallida." },
        { status: 400 }
      );
    }
  }

  if (isBefore(startsAt, new Date())) {
    return NextResponse.json(
      { error: "La hora seleccionada debe ser futura." },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .select("id")
    .eq("id", org_id)
    .maybeSingle();

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }
  if (!org) {
    return NextResponse.json(
      { error: "Organización no encontrada." },
      { status: 404 }
    );
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_min, stripe_price_id, active")
    .eq("id", service_id)
    .eq("org_id", org_id)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json(
      { error: serviceError.message },
      { status: 500 }
    );
  }

  if (!service || !service.active) {
    return NextResponse.json(
      { error: "Servicio no encontrado o inactivo." },
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

  const endsAt = addMinutes(startsAt, service.duration_min);
  
  // P0.2: TTL de holds - usar HOLD_TTL_MIN de env (default 10 minutos)
  const holdTtlMinutes = Number(process.env.HOLD_TTL_MIN || HOLD_TTL_MINUTES);
  const expiresAt = addMinutes(new Date(), holdTtlMinutes);

  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        org_id,
        service_id,
        starts_at,
        ends_at: endsAt.toISOString(),
        status: "hold",
        expires_at: expiresAt.toISOString(),
      },
    ])
    .select("id")
    .single();

  if (error) {
    // P0.3: Manejar error 23P01 (exclusion violation = solape)
    if (error.code === "23P01") {
      // Mensaje de error amigable para solapes
      // Nota: Por ahora usamos un mensaje genérico, pero podríamos usar la función helper
      // si tenemos staff_id disponible (requiere modificar el schema de appointments)
      return NextResponse.json(
        { 
          error: "El intervalo seleccionado ya está ocupado. Por favor, elige otro horario.",
          code: "23P01"
        },
        { status: 409 }
      );
    }
    console.error("hold:error", {
      error: error.message,
      code: error.code,
      org_id
    });
    return NextResponse.json(
      { error: error.message ?? "Error al crear reserva" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    appointment_id: data?.id,
    price_id: service.stripe_price_id,
    expires_at: expiresAt.toISOString(),
  });
}

