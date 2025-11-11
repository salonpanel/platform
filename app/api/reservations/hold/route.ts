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

  if (holdRateLimit) {
    const { success } = await holdRateLimit.limit(`hold:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Se han realizado demasiadas solicitudes. Inténtalo más tarde." },
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

  if (!service.stripe_price_id) {
    return NextResponse.json(
      { error: "El servicio no tiene un Stripe price id configurado." },
      { status: 400 }
    );
  }

  const endsAt = addMinutes(startsAt, service.duration_min);
  const expiresAt = addMinutes(new Date(), HOLD_TTL_MINUTES);

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
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "El intervalo seleccionado ya está ocupado." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    appointment_id: data?.id,
    price_id: service.stripe_price_id,
    expires_at: expiresAt.toISOString(),
  });
}

