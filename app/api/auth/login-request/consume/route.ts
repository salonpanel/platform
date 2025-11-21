/**
 * API Route: Consume/login request tokens
 * 
 * After the client has successfully set the session using the tokens,
 * this endpoint clears the tokens from the database for security
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
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

    // Verify user is authenticated
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
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

    // Verify the request belongs to this user's email
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("auth_login_requests")
      .select("id, email, status")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    // Verify email matches (security check)
    if (request.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "No autorizado para consumir esta solicitud" },
        { status: 403 }
      );
    }

    // Clear tokens (set to null for security)
    const { error: updateError } = await supabaseAdmin
      .from("auth_login_requests")
      .update({
        supabase_access_token: null,
        supabase_refresh_token: null,
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Error clearing tokens:", updateError);
      return NextResponse.json(
        { error: "Error al limpiar tokens" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unexpected error consuming login request:", err);
    return NextResponse.json(
      { error: "Error inesperado" },
      { status: 500 }
    );
  }
}

