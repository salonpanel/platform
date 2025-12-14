import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { createClientForServer } from "@/lib/supabase/server-client";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/stripe/connect
 * Inicia el proceso de onboarding de Stripe Connect para un tenant
 * 
 * Response:
 * - url: URL para redirigir al barbero al onboarding de Stripe
 * - account_id: ID de la cuenta Stripe creada/obtenida
 */
export async function POST(req: Request) {
  try {
    // 1. Verificar autenticación
    const supabaseAuth = await createClientForServer();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const supabase = supabaseServer();

    // 2. Obtener tenant del usuario
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No tienes permisos para gestionar pagos. Se requiere rol owner o admin." },
        { status: 403 }
      );
    }

    const tenantId = membership.tenant_id;

    // 3. Obtener información del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, stripe_account_id")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    let stripeAccountId = tenant.stripe_account_id;

    // 4. Si NO tiene stripe_account_id → crear cuenta estándar
    if (!stripeAccountId) {
      try {
        // Obtener email del propietario (usar email del usuario o buscar en profiles)
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();

        const ownerEmail = profile?.email || session.user.email || "";

        if (!ownerEmail) {
          return NextResponse.json(
            { error: "No se pudo obtener el email del propietario" },
            { status: 400 }
          );
        }

        // Crear cuenta Stripe Standard
        const account = await stripe.accounts.create({
          type: "standard",
          email: ownerEmail,
          metadata: {
            tenant_id: tenantId,
            tenant_name: tenant.name || "",
          },
        });

        stripeAccountId = account.id;

        // Guardar stripe_account_id en Supabase
        const { error: updateError } = await supabase
          .from("tenants")
          .update({
            stripe_account_id: stripeAccountId,
            stripe_onboarding_status: "pending"
          })
          .eq("id", tenantId);

        if (updateError) {
          console.error("Error guardando stripe_account_id:", updateError);
          return NextResponse.json(
            { error: `Error guardando cuenta Stripe: ${updateError.message}` },
            { status: 500 }
          );
        }
      } catch (stripeError: any) {
        console.error("Error creando cuenta Stripe:", stripeError);
        return NextResponse.json(
          { error: `Error creando cuenta Stripe: ${stripeError?.message ?? "Error desconocido"}` },
          { status: 500 }
        );
      }
    }

    // 5. Crear account link para onboarding
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pro.bookfast.es";

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/panel/monedero`,
        return_url: `${baseUrl}/panel/monedero`,
        type: "account_onboarding",
      });

      return NextResponse.json({
        url: accountLink.url,
        account_id: stripeAccountId,
      });
    } catch (stripeError: any) {
      console.error("Error creando account link:", stripeError);
      return NextResponse.json(
        { error: `Error creando enlace de onboarding: ${stripeError?.message ?? "Error desconocido"}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error en POST /api/payments/stripe/connect:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

