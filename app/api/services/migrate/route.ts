import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { stripe } from "@/lib/stripe";

const CURRENCY = process.env.STRIPE_DEFAULT_CURRENCY ?? "eur";

type MigrateRequest = {
  org_id?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as MigrateRequest;
  const orgId = body.org_id;

  if (!orgId) {
    return NextResponse.json(
      { error: "org_id es obligatorio." },
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401 }
    );
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "No tienes permisos sobre esta organización." },
      { status: 403 }
    );
  }

  const { data: services, error: fetchError } = await supabase
    .from("services")
    .select(
      "id, name, price_cents, duration_min, active, stripe_product_id, stripe_price_id"
    )
    .eq("org_id", orgId);

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: 500 }
    );
  }

  const toMigrate = (services ?? []).filter(
    (service) => !service.stripe_product_id || !service.stripe_price_id
  );

  const results: Array<{
    service_id: string;
    product_id: string;
    price_id: string;
  }> = [];

  for (const service of toMigrate) {
    try {
      let productId = service.stripe_product_id;

      if (!productId) {
        const product = await stripe.products.create({
          name: service.name,
          active: service.active ?? true,
          metadata: {
            org_id: orgId,
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
          org_id: orgId,
          service_id: service.id,
        },
      });

      const { error: updateError } = await supabase
        .from("services")
        .update({
          stripe_product_id: productId,
          stripe_price_id: price.id,
        })
        .eq("id", service.id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      results.push({
        service_id: service.id,
        product_id: productId,
        price_id: price.id,
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? "Error migrando servicios." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    migrated: results.length,
    total_pending: toMigrate.length - results.length,
    details: results,
  });
}

