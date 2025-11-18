import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { stripe } from "@/lib/stripe";

const CURRENCY = process.env.STRIPE_DEFAULT_CURRENCY ?? "eur";

type MigrateRequest = {
  tenant_id?: string;
  org_id?: string; // compatibilidad legacy
};

export async function POST(req: Request) {
  const body = (await req.json()) as MigrateRequest;
  const tenantId = body.tenant_id ?? body.org_id;

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenant_id es obligatorio." },
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
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
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
    .eq("tenant_id", tenantId);

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
            tenant_id: tenantId,
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
          tenant_id: tenantId,
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

  const syncedCount = results.length;

  return NextResponse.json({
    syncedCount,
    totalPending: Math.max((toMigrate?.length || 0) - syncedCount, 0),
    details: results,
  });
}

