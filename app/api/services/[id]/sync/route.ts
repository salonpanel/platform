import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

const CURRENCY = process.env.STRIPE_DEFAULT_CURRENCY ?? "eur";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido." }, { status: 400 });
    }

    const supabaseAuth = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const supabase = supabaseServer();
    const { data: service, error: fetchError } = await supabase
      .from("services")
      .select(
        "id, tenant_id, name, price_cents, active, stripe_product_id, stripe_price_id"
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado." },
        { status: 404 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("tenant_id", service.tenant_id)
      .eq("user_id", session.user.id)
      .in("role", ["owner", "admin", "manager"])
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No tienes permiso para sincronizar este servicio." },
        { status: 403 }
      );
    }

    let productId = service.stripe_product_id;

    if (!productId) {
      const product = await stripe.products.create({
        name: service.name,
        active: service.active ?? true,
        metadata: {
          tenant_id: service.tenant_id,
          service_id: service.id,
        },
      });
      productId = product.id;
    }

    const price = await stripe.prices.create({
      product: productId,
      currency: CURRENCY,
      unit_amount: service.price_cents,
      metadata: {
        tenant_id: service.tenant_id,
        service_id: service.id,
      },
    });

    const { data: updated, error: updateError } = await supabase
      .from("services")
      .update({
        stripe_product_id: productId,
        stripe_price_id: price.id,
      })
      .eq("id", service.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo sincronizar el servicio." },
      { status: 500 }
    );
  }
}

