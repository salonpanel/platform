import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/test-checkout
 * 
 * ⚠️ SOLO PARA DEBUGGING - NO USAR EN PRODUCCIÓN
 * 
 * Endpoint de prueba SOLO para desarrollo que crea un Checkout Session
 * hacia la cuenta conectada de test (acct_1SVZEHAxlvkkj3nk)
 * 
 * Body:
 * - booking_id: UUID del booking de test
 * 
 * Response:
 * - url: URL del checkout para probar
 * 
 * ⚠️ SOLO DISPONIBLE EN DESARROLLO
 */
export async function POST(req: Request) {
  // Solo permitir en desarrollo - devolver 404 en otros entornos
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not Found" },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const { booking_id } = body;

    if (!booking_id) {
      return NextResponse.json(
        { error: "booking_id es requerido" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Obtener booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, tenant_id, service_id, customer_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking no encontrado" },
        { status: 404 }
      );
    }

    // Obtener servicio
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, price_cents, deposit_enabled, deposit_type, deposit_amount, deposit_percent")
      .eq("id", booking.service_id)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    // Obtener tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, stripe_account_id")
      .eq("id", booking.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Tenant no encontrado" },
        { status: 404 }
      );
    }

    // Usar cuenta de test si no hay cuenta conectada
    const stripeAccountId = tenant.stripe_account_id || "acct_1SVZEHAxlvkkj3nk";

    // Calcular monto
    const price = service.price_cents / 100;
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

    // Obtener customer email
    const { data: customer } = await supabase
      .from("customers")
      .select("email, name")
      .eq("id", booking.customer_id)
      .maybeSingle();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Crear Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customer?.email || "test@example.com",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: service.name,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        on_behalf_of: stripeAccountId,
        transfer_data: {
          destination: stripeAccountId,
        },
        metadata: {
          tenant_id: booking.tenant_id,
          service_id: service.id,
          booking_id: booking.id,
          deposit: deposit?.toString() || "",
          total_price: price.toString(),
        },
      },
      metadata: {
        tenant_id: booking.tenant_id,
        service_id: service.id,
        booking_id: booking.id,
        deposit: deposit?.toString() || "",
        total_price: price.toString(),
      },
      success_url: `${baseUrl}/reserva/confirmada?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/reserva/cancelada`,
    });

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
      stripe_account_id: stripeAccountId,
      amount: amount,
      deposit: deposit,
      total_price: price,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Error inesperado";
    console.error("Error en POST /api/internal/test-checkout:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

