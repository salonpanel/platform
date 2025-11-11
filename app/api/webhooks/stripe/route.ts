import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs"; // necesario para raw body
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("stripe-signature") || "";
    const rawBody = Buffer.from(await req.arrayBuffer());

    const event = stripe.webhooks.constructEvent(
      rawBody,
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

        if (error) {
          console.error("Supabase update error:", error);
          return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Stripe webhook error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: `Webhook Error: ${err?.message || "unknown"}` },
      { status: 400 }
    );
  }
}

