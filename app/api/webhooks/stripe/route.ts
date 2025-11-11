import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs"; // raw body compatible
export const dynamic = "force-dynamic"; // evitar cache

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("stripe-signature") || "";
    const raw = Buffer.from(await req.arrayBuffer());

    const event = stripe.webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const appointmentId = session?.metadata?.appointment_id;

      if (appointmentId) {
        const sb = supabaseServer();
        const { error } = await sb
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", appointmentId);

        if (error) throw error;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err?.message || err);
    return NextResponse.json(
      { error: `Webhook Error: ${err?.message || "unknown"}` },
      { status: 400 }
    );
  }
}

