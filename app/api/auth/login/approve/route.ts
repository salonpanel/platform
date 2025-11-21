/**
 * API Route: Approve login request
 * 
 * This endpoint is called from the mobile device when the user clicks the magic link.
 * It uses service role to update the auth_login_requests table with the session tokens.
 * 
 * IMPORTANT: This endpoint uses service role to bypass RLS and update all fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, secretToken, code, accessToken, refreshToken } = body;

    console.log("[ApproveAPI] Request received:", {
      requestId: requestId || null,
      secretToken: secretToken ? "present" : "missing",
      hasCode: !!code,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });

    if (!requestId || !secretToken) {
      console.error("[ApproveAPI] Missing required params");
      return NextResponse.json(
        { error: "requestId y secretToken requeridos" },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS
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

    // Validate that the request exists, is pending, and secret_token matches
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("auth_login_requests")
      .select("id, email, status, secret_token, created_at")
      .eq("id", requestId)
      .eq("status", "pending")
      .single();

    if (fetchError || !request) {
      console.error("[ApproveAPI] Request not found or not pending:", fetchError);
      return NextResponse.json(
        { error: "Solicitud no encontrada o ya procesada" },
        { status: 404 }
      );
    }

    if (request.secret_token !== secretToken) {
      console.error("[ApproveAPI] Secret token mismatch");
      return NextResponse.json(
        { error: "Token secreto inválido" },
        { status: 403 }
      );
    }

    // Get session tokens
    let finalAccessToken = accessToken;
    let finalRefreshToken = refreshToken;

    // If we have code but not tokens, exchange code for session
    if (code && (!finalAccessToken || !finalRefreshToken)) {
      console.log("[ApproveAPI] Exchanging code for session...");
      
      // Create a temporary client to exchange code
      const tempClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data: sessionData, error: exchangeError } = await tempClient.auth.exchangeCodeForSession(code);

      if (exchangeError || !sessionData?.session) {
        console.error("[ApproveAPI] Error exchanging code:", exchangeError);
        return NextResponse.json(
          { error: "Error al intercambiar código por sesión" },
          { status: 400 }
        );
      }

      finalAccessToken = sessionData.session.access_token;
      finalRefreshToken = sessionData.session.refresh_token;
      
      console.log("[ApproveAPI] Code exchanged successfully");
    }

    if (!finalAccessToken || !finalRefreshToken) {
      console.error("[ApproveAPI] Missing tokens after processing");
      return NextResponse.json(
        { error: "No se pudieron obtener los tokens de sesión" },
        { status: 400 }
      );
    }

    // Update the request with tokens
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("auth_login_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        supabase_access_token: finalAccessToken,
        supabase_refresh_token: finalRefreshToken,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .eq("secret_token", secretToken)
      .select()
      .single();

    if (updateError) {
      console.error("[ApproveAPI] Update error:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la solicitud" },
        { status: 500 }
      );
    }

    if (!updated) {
      console.error("[ApproveAPI] Update returned no rows");
      return NextResponse.json(
        { error: "No se pudo actualizar la solicitud" },
        { status: 500 }
      );
    }

    console.log("[ApproveAPI] Request approved successfully:", {
      id: updated.id,
      email: updated.email,
      status: updated.status,
      approved_at: updated.approved_at,
      hasAccessToken: !!updated.supabase_access_token,
      hasRefreshToken: !!updated.supabase_refresh_token,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[ApproveAPI] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error inesperado" },
      { status: 500 }
    );
  }
}

