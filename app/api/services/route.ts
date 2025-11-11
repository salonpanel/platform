import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
const CURRENCY = process.env.STRIPE_DEFAULT_CURRENCY ?? "eur";

type CreateServiceRequest = {
  org_id?: string;
  name?: string;
  duration_min?: number;
  price_cents?: number;
};

export async function POST(req: Request) {
  const payload = (await req.json()) as CreateServiceRequest;
  const { org_id, name, duration_min, price_cents } = payload;

  if (!org_id || !name || !duration_min || !price_cents) {
    return NextResponse.json(
      { error: "org_id, name, duration_min y price_cents son obligatorios." },
      { status: 400 }
    );
  }

  if (duration_min <= 0 || price_cents < 0) {
    return NextResponse.json(
      { error: "Valores de duración o precio no válidos." },
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org_id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "No tienes permiso para gestionar esta organización." },
      { status: 403 }
    );
  }

  try {
    const product = await stripe.products.create({
      name,
      metadata: { org_id },
      active: true,
    });

    const price = await stripe.prices.create({
      product: product.id,
      currency: CURRENCY,
      unit_amount: price_cents,
      metadata: { org_id },
    });

    const { data, error } = await supabase
      .from("services")
      .insert([
        {
          org_id,
          name,
          duration_min,
          price_cents,
          active: true,
          stripe_product_id: product.id,
          stripe_price_id: price.id,
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
