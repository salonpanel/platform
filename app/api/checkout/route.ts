import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

type CheckoutRequest = {
  appointment_id?: string;
  price_id?: string;
  success_url?: string;
  cancel_url?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutRequest;
    const { appointment_id, price_id, success_url, cancel_url } = body;

    if (!appointment_id || !price_id || !success_url || !cancel_url) {
      return NextResponse.json(
        { error: "Faltan parámetros obligatorios." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: { appointment_id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear el checkout." },
      { status: 500 }
    );
  }
}

