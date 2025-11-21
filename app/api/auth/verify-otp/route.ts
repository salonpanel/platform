// app/api/auth/verify-otp/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// import type { Database } from "@/lib/database.types"; // si tienes tipos

export async function POST(req: Request) {
  try {
    console.log("[VerifyOTP API] Iniciando verificación OTP...");
    
    // Parsear body con manejo de errores
    let body;
    try {
      body = await req.json();
      console.log("[VerifyOTP API] Body recibido:", { 
        hasEmail: !!body?.email, 
        hasCode: !!body?.code,
        emailLength: body?.email?.length,
        codeLength: body?.code?.length 
      });
    } catch (parseError: any) {
      console.error("[VerifyOTP API] Error parseando JSON:", parseError);
      return NextResponse.json(
        { error: "Error al procesar la solicitud." },
        { status: 400 }
      );
    }

    const { email, code } = body;

    if (!email || !code) {
      console.error("[VerifyOTP API] Datos incompletos:", { email: !!email, code: !!code });
      return NextResponse.json(
        { error: "Email y código son obligatorios." },
        { status: 400 }
      );
    }

    console.log("[VerifyOTP API] Creando cliente Supabase...");
    // 👇 Patrón correcto en Next.js 16 App Router
    let supabase;
    try {
      supabase = createRouteHandlerClient/*<Database>*/({ cookies });
      console.log("[VerifyOTP API] Cliente Supabase creado correctamente");
    } catch (clientError: any) {
      console.error("[VerifyOTP API] Error al crear cliente Supabase:", {
        message: clientError?.message,
        name: clientError?.name,
        stack: clientError?.stack,
      });
      return NextResponse.json(
        { error: "Error al inicializar el cliente de autenticación." },
        { status: 500 }
      );
    }

    // 1) Verificar OTP (tipo "email" porque estás usando código por email)
    console.log("[VerifyOTP API] Llamando a verifyOtp...", { 
      email: email.substring(0, 5) + "...", 
      codeLength: code.length 
    });
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email", // <- IMPORTANTE
    });

    if (error) {
      console.error("[VerifyOTP API] Error en verifyOtp:", {
        message: error.message,
        name: error.name,
        status: error.status,
      });
      return NextResponse.json(
        { error: error.message ?? "Error en la verificación del código." },
        { status: 400 }
      );
    }

    if (!data.session) {
      console.error("[VerifyOTP API] verifyOtp no devolvió sesión:", {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
      });
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
    console.error("[VerifyOTP API] Error inesperado:", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      cause: err?.cause,
    });
    return NextResponse.json(
      { 
        error: "Error interno al verificar el código.",
        // Solo en desarrollo, incluir más detalles
        ...(process.env.NODE_ENV === "development" && {
          details: err?.message,
        }),
      },
      { status: 500 }
    );
  }
}
