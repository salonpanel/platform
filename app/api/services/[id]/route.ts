import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type UpdateServiceRequest = {
  active?: boolean;
};

type RouteParams = {
  params: { id: string };
};

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const payload = (await req.json()) as UpdateServiceRequest;

  if (typeof payload.active !== "boolean") {
    return NextResponse.json(
      { error: "El campo active es obligatorio." },
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

  const { data: service, error: fetchError } = await supabase
    .from("services")
    .select("id, org_id, active, stripe_product_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", service.org_id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "No tienes permiso para gestionar esta organización." },
      { status: 403 }
    );
  }

  try {
    if (service.stripe_product_id) {
      await stripe.products.update(service.stripe_product_id, {
        active: payload.active,
      });
    }

    const { data: updated, error } = await supabase
      .from("services")
      .update({ active: payload.active })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo actualizar el servicio." },
      { status: 500 }
    );
  }
}

