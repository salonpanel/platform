/**
 * API Route: Get login request status
 * 
 * Allows the client to poll for request status
 * Returns request data without sensitive tokens
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId requerido" },
        { status: 400 }
      );
    }

    // Use service role to read the request
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

    const { data, error } = await supabaseAdmin
      .from("auth_login_requests")
      .select("id, email, status, created_at, approved_at, redirect_path, supabase_access_token, supabase_refresh_token")
      .eq("id", requestId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    // Check if expired (15 minutes)
    const createdAt = new Date(data.created_at);
    const now = new Date();
    const minutesElapsed = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    if (data.status === "pending" && minutesElapsed > 15) {
      // Mark as expired
      await supabaseAdmin
        .from("auth_login_requests")
        .update({ status: "expired" })
        .eq("id", requestId);
      
      return NextResponse.json({
        id: data.id,
        email: data.email,
        status: "expired",
        redirectPath: data.redirect_path,
        accessToken: null,
        refreshToken: null,
      });
    }

    // Log cada respuesta para debug
    console.log("[StatusAPI] status", {
      id: data.id,
      email: data.email,
      status: data.status,
      hasTokens: !!(data.supabase_access_token && data.supabase_refresh_token),
    });

    // Return status and tokens if approved
    return NextResponse.json({
      id: data.id,
      email: data.email,
      status: data.status,
      redirectPath: data.redirect_path,
      accessToken: data.supabase_access_token || null,
      refreshToken: data.supabase_refresh_token || null,
    });
  } catch (err: any) {
    console.error("Unexpected error getting login request status:", err);
    return NextResponse.json(
      { error: "Error inesperado" },
      { status: 500 }
    );
  }
}

