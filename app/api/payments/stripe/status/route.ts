import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { createClientForServer } from "@/lib/supabase/server-client";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/stripe/status
 * Obtiene el estado del onboarding de Stripe Connect para el tenant actual
 * 
 * Response:
 * - charges_enabled: Si la cuenta puede recibir pagos
 * - payouts_enabled: Si la cuenta puede recibir payouts
 * - details_submitted: Si se completaron los detalles requeridos
 * - onboarding_status: Estado del onboarding
 * - future_requirements: Requisitos pendientes (si los hay)
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

    // 3. Obtener información del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, stripe_account_id, stripe_onboarding_status")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // 4. Si no tiene cuenta Stripe, retornar estado inicial
    if (!tenant.stripe_account_id) {
      return NextResponse.json({
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        onboarding_status: "pending",
        future_requirements: null,
        connected: false,
      });
    }

    // 5. Obtener estado desde Stripe
    try {
      const account = await stripe.accounts.retrieve(tenant.stripe_account_id);

      // Actualizar estado en Supabase
      const onboardingStatus = account.details_submitted && account.charges_enabled && account.payouts_enabled
        ? "completed"
        : account.details_submitted
          ? "restricted"
          : "pending";

      await supabase
        .from("tenants")
        .update({
          stripe_onboarding_status: onboardingStatus,
          stripe_charges_enabled: account.charges_enabled || false,
          stripe_payouts_enabled: account.payouts_enabled || false,
        })
        .eq("id", tenantId);

      return NextResponse.json({
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        details_submitted: account.details_submitted || false,
        onboarding_status: onboardingStatus,
        future_requirements: account.future_requirements?.errors || null,
        connected: true,
        account_id: tenant.stripe_account_id,
      });
    } catch (stripeError: any) {
      console.error("Error obteniendo estado de cuenta Stripe:", stripeError);
      return NextResponse.json(
        { error: `Error obteniendo estado: ${stripeError?.message ?? "Error desconocido"}` },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error en GET /api/payments/stripe/status:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}

