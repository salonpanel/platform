/**
 * API Route: Cancel a login request
 * 
 * Allows the client to cancel a pending login request
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json(
        { error: "requestId requerido" },
        { status: 400 }
      );
    }

    // Use service role to update the request
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { error } = await supabaseAdmin
      .from("auth_login_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId)
      .eq("status", "pending"); // Only cancel if still pending

    if (error) {
      console.error("Error cancelling login request:", error);
      return NextResponse.json(
        { error: "Error al cancelar la solicitud" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error cancelling login request:", err);
    return NextResponse.json(
      { error: "Error inesperado" },
      { status: 500 }
    );
  }
}

