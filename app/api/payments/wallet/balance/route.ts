import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/wallet/balance
 * Obtiene el balance actual de la cuenta Stripe Connect del tenant
 * 
 * Response:
 * - pending: Dinero retenido temporalmente
 * - available: Dinero listo para payout
 * - currency: Moneda
 */
export async function GET(req: Request) {
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

    // 4. Obtener balance desde Stripe
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: tenant.stripe_account_id,
      });

      return NextResponse.json({
        pending: balance.pending.reduce((sum, item) => sum + item.amount, 0) / 100,
        available: balance.available.reduce((sum, item) => sum + item.amount, 0) / 100,
        currency: balance.available[0]?.currency || "eur",
        pending_breakdown: balance.pending.map((item) => ({
          amount: item.amount / 100,
          currency: item.currency,
          source_types: item.source_types,
        })),
        available_breakdown: balance.available.map((item) => ({
          amount: item.amount / 100,
          currency: item.currency,
          source_types: item.source_types,
        })),
      });
    } catch (stripeError: any) {
      console.error("Error obteniendo balance de Stripe:", stripeError);
      return NextResponse.json(
        { error: `Error obteniendo balance: ${stripeError?.message ?? "Error desconocido"}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error en GET /api/payments/wallet/balance:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

