/**
 * API Route: Create a login request for remote approval
 * 
 * Creates a new login request in auth_login_requests table
 * Returns the request ID and secret token for the client
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, redirectPath } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Email válido requerido" },
        { status: 400 }
      );
    }

    // Generate secure random token (32 chars)
    const secretToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 32);

    // Use service role to create the request
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
      .insert({
        email: email.toLowerCase().trim(),
        status: "pending",
        redirect_path: redirectPath || "/panel",
        secret_token: secretToken,
      })
      .select("id, email, status, created_at, redirect_path")
      .single();

    if (error) {
      console.error("Error creating login request:", error);
      return NextResponse.json(
        { error: "Error al crear la solicitud de login" },
        { status: 500 }
      );
    }

    // Log el resultado de la creación
    console.log("[CreateLoginRequest] Created", {
      id: data.id,
      email: data.email,
      redirect_path: data.redirect_path,
      status: data.status,
    });

    // Return request ID and secret token to client
    // Client will use secret_token in the magic link URL
    return NextResponse.json({
      requestId: data.id,
      secretToken: secretToken, // Only returned once, client must store it
      email: data.email,
      redirectPath: data.redirect_path,
    });
  } catch (err: any) {
    console.error("Unexpected error creating login request:", err);
    return NextResponse.json(
      { error: "Error inesperado al crear la solicitud" },
      { status: 500 }
    );
  }
}

