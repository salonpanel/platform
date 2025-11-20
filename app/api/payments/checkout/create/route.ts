import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutCreateRequest = {
  service_id: string;
  booking_id: string;
  customer_email: string;
  customer_name?: string;
};

/**
 * POST /api/payments/checkout/create
 * Crea un Checkout Session de Stripe Connect para cobrar directamente a la cuenta del tenant
 * 
 * Body:
 * - service_id: UUID del servicio
 * - booking_id: UUID del booking
 * - customer_email: Email del cliente
 * - customer_name: Nombre del cliente (opcional)
 * 
 * Response:
 * - url: URL del checkout para redirigir al cliente
 */
export async function POST(req: Request) {
  try {
    // 1. Verificar autenticación (opcional - puede ser público para reservas)
    const body = (await req.json()) as CheckoutCreateRequest;
    const { service_id, booking_id, customer_email, customer_name } = body;

    if (!service_id || !booking_id || !customer_email) {
      return NextResponse.json(
        { error: "service_id, booking_id y customer_email son requeridos" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // 2. Obtener servicio y verificar configuración
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, tenant_id, name, price_cents, deposit_enabled, deposit_type, deposit_amount, deposit_percent")
      .eq("id", service_id)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    const tenantId = service.tenant_id;

    // 3. Obtener stripe_account_id del tenant y verificar que está completado
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled")
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

    if (!tenant.stripe_charges_enabled || !tenant.stripe_payouts_enabled) {
      return NextResponse.json(
        { error: "La cuenta Stripe no está completamente configurada" },
        { status: 400 }
      );
    }

    // 4. Calcular monto a cobrar (total o depósito)
    const price = service.price_cents / 100; // Convertir de céntimos a euros
    let amount = price;
    let deposit: number | null = null;

    if (service.deposit_enabled) {
      if (service.deposit_type === "percent" && service.deposit_percent) {
        deposit = price * (service.deposit_percent / 100);
        amount = deposit;
      } else if (service.deposit_type === "fixed" && service.deposit_amount !== null && service.deposit_amount !== undefined) {
        deposit = service.deposit_amount;
        amount = service.deposit_amount; // Usar directamente service.deposit_amount que ya está verificado
      }
    }

    // 5. Obtener booking para metadata adicional
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, tenant_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking || booking.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: "Booking no encontrado o no pertenece al tenant" },
        { status: 404 }
      );
    }

    // 6. Crear Checkout Session con Stripe Connect
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pro.bookfast.es";
    const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || baseUrl;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer_email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: service.name,
            },
            unit_amount: Math.round(amount * 100), // Convertir a céntimos
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        on_behalf_of: tenant.stripe_account_id,
        transfer_data: {
          destination: tenant.stripe_account_id,
        },
        metadata: {
          tenant_id: tenantId,
          service_id: service_id,
          booking_id: booking_id,
          deposit: deposit?.toString() || "",
          total_price: price.toString(),
        },
      },
      metadata: {
        tenant_id: tenantId,
        service_id: service_id,
        booking_id: booking_id,
        deposit: deposit?.toString() || "",
        total_price: price.toString(),
      },
      success_url: `${clientUrl}/reserva/confirmada?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/reserva/cancelada`,
    });

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Error inesperado";
    console.error("Error en POST /api/payments/checkout/create:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

