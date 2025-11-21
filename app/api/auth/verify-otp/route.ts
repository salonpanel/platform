// app/api/auth/verify-otp/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// import type { Database } from "@/lib/database.types"; // si tienes tipos

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email y código son obligatorios." },
        { status: 400 }
      );
    }

    // 👇 Patrón correcto en Next.js 16 App Router
    const supabase = createRouteHandlerClient/*<Database>*/({ cookies });

    // 1) Verificar OTP (tipo "email" porque estás usando código por email)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email", // <- IMPORTANTE
    });

    if (error) {
      console.error("[VerifyOTP API] Error en verifyOtp:", error);
      return NextResponse.json(
        { error: error.message ?? "Error en la verificación del código." },
        { status: 400 }
      );
    }

    if (!data.session) {
      console.error("[VerifyOTP API] verifyOtp no devolvió sesión.");
      return NextResponse.json(
        { error: "No se pudo establecer la sesión." },
        { status: 400 }
      );
    }

    // 2) En este punto, Supabase ya ha escrito las cookies de sesión a través del helper
    //    No hace falta llamar a setSession aquí.

    console.log("[VerifyOTP API] Sesión creada correctamente:", {
      userId: data.session.user?.id,
      email: data.session.user?.email,
    });

    // Puedes devolver solo OK; el cliente ya redirige a /panel
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[VerifyOTP API] Error inesperado:", err);
    return NextResponse.json(
      { error: "Error interno al verificar el código." },
      { status: 500 }
    );
  }
}
