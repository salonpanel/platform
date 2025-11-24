import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/wallet/payouts
 * Obtiene los payouts de la cuenta Stripe Connect
 * 
 * Query params:
 * - limit: Número de payouts (default: 10, max: 100)
 * - starting_after: ID de payout para paginación
 * 
 * Response:
 * - payouts: Array de payouts
 * - has_more: Si hay más payouts
 */
export async function GET(req: Request) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // No necesitamos setAll para solo lectura
          },
        },
      }
    );
    
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
      .select("tenant_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No se pudo obtener el tenant" },
        { status: 403 }
      );
    }

    const tenantId = membership.tenant_id;

    // 3. Obtener stripe_account_id del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("stripe_account_id")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    if (!tenant.stripe_account_id) {
      return NextResponse.json(
        { error: "Stripe no está conectado para este tenant" },
        { status: 400 }
      );
    }

    // 4. Obtener parámetros de query
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const startingAfter = searchParams.get("starting_after");

    // 5. Obtener payouts desde Stripe
    try {
      const params: Stripe.PayoutListParams = {
        limit,
      };

      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const payouts = await stripe.payouts.list(params, {
        stripeAccount: tenant.stripe_account_id,
      });

      const formattedPayouts = payouts.data.map((payout) => ({
        id: payout.id,
        amount: payout.amount / 100, // Convertir de céntimos a euros
        currency: payout.currency,
        status: payout.status,
        arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
        created: new Date(payout.created * 1000).toISOString(),
        description: payout.description,
        method: payout.method,
        type: payout.type,
      }));

      return NextResponse.json({
        payouts: formattedPayouts,
        has_more: payouts.has_more,
        next_starting_after: payouts.data[payouts.data.length - 1]?.id || null,
      });
    } catch (stripeError: any) {
      console.error("Error obteniendo payouts de Stripe:", stripeError);
      return NextResponse.json(
        { error: `Error obteniendo payouts: ${stripeError?.message ?? "Error desconocido"}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error en GET /api/payments/wallet/payouts:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

