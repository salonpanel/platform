/**
 * API Route: Update login request with tokens
 * 
 * Updates the most recent pending login request for an email with tokens
 * Used when Supabase redirects with tokens in hash instead of code
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, email, accessToken, refreshToken } = body;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: "accessToken y refreshToken requeridos" },
        { status: 400 }
      );
    }

    if (!requestId && !email) {
      return NextResponse.json(
        { error: "requestId o email requerido" },
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

    let updated;

    if (requestId) {
      // Actualizar por requestId
      const { data, error: updateError } = await supabaseAdmin
        .from("auth_login_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          supabase_access_token: accessToken,
          supabase_refresh_token: refreshToken,
        })
        .eq("id", requestId)
        .eq("status", "pending")
        .select()
        .single();

      if (updateError) {
        console.error("[UpdateAPI] Error updating request:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar la solicitud" },
          { status: 500 }
        );
      }
      updated = data;
    } else if (email) {
      // Buscar la request pendiente más reciente para este email (últimos 15 minutos)
      const { data: pendingRequest, error: lookupError } = await supabaseAdmin
        .from("auth_login_requests")
        .select("id, secret_token, created_at, redirect_path")
        .eq("email", email.toLowerCase())
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        console.error("[UpdateAPI] Error looking up request:", lookupError);
        return NextResponse.json(
          { error: "Error al buscar la solicitud" },
          { status: 500 }
        );
      }

      if (!pendingRequest) {
        return NextResponse.json(
          { error: "No se encontró solicitud pendiente para este email" },
          { status: 404 }
        );
      }

      // Actualizar la request encontrada
      const { data, error: updateError } = await supabaseAdmin
        .from("auth_login_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          supabase_access_token: accessToken,
          supabase_refresh_token: refreshToken,
        })
        .eq("id", pendingRequest.id)
        .eq("status", "pending")
        .select()
        .single();

      if (updateError) {
        console.error("[UpdateAPI] Error updating request:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar la solicitud" },
          { status: 500 }
        );
      }
      updated = data;
    } else {
      return NextResponse.json(
        { error: "requestId o email requerido" },
        { status: 400 }
      );
    }

    if (updateError) {
      console.error("[UpdateAPI] Error updating request:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la solicitud" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Solicitud no encontrada o ya procesada" },
        { status: 404 }
      );
    }

    console.log("[UpdateAPI] Request updated:", {
      id: updated.id,
      email: updated.email,
      status: updated.status,
    });

    return NextResponse.json({
      success: true,
      requestId: updated.id,
      redirectPath: updated.redirect_path || "/panel",
    });
  } catch (err: any) {
    console.error("Unexpected error updating login request:", err);
    return NextResponse.json(
      { error: "Error inesperado" },
      { status: 500 }
    );
  }
}

