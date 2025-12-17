import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/wallet/transactions
 * Obtiene las transacciones de balance de la cuenta Stripe Connect
 * 
 * Query params:
 * - limit: Número de transacciones (default: 20, max: 100)
 * - starting_after: ID de transacción para paginación
 * 
 * Response:
 * - transactions: Array de transacciones
 * - has_more: Si hay más transacciones
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

    // 4. Obtener parámetros de query
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const startingAfter = searchParams.get("starting_after");

    // 5. Obtener transacciones desde Stripe
    try {
      const params: Stripe.BalanceTransactionListParams = {
        limit,
      };

      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const balanceTransactions = await stripe.balanceTransactions.list(
        params,
        {
          stripeAccount: tenant.stripe_account_id,
        }
      );

      const transactions = balanceTransactions.data.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount / 100, // Convertir de céntimos a euros
        currency: tx.currency,
        fee: tx.fee / 100,
        net: tx.net / 100,
        status: tx.status,
        created: new Date(tx.created * 1000).toISOString(),
        description: tx.description,
        source: tx.source,
      }));

      return NextResponse.json({
        transactions,
        has_more: balanceTransactions.has_more,
        next_starting_after: balanceTransactions.data[balanceTransactions.data.length - 1]?.id || null,
      });
    } catch (stripeError: any) {
      console.error("Error obteniendo transacciones de Stripe:", stripeError);
      return NextResponse.json(
        { error: `Error obteniendo transacciones: ${stripeError?.message ?? "Error desconocido"}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error en GET /api/payments/wallet/transactions:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

