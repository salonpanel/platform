import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * Route Handler para verificar código OTP
 * 
 * CRÍTICO: Este endpoint debe ejecutarse en el servidor porque:
 * 1. Usa createRouteHandlerClient({ cookies }) que escribe cookies de sesión
 * 2. Las cookies escritas aquí son accesibles por el middleware y server components
 * 3. Si se hace en el cliente, la sesión solo existe en localStorage y el servidor no la ve
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch((err) => {
      console.error("[VerifyOTP API] Error parsing request body:", err);
      return null;
    });

    if (!body || !body.email || !body.token) {
      console.error("[VerifyOTP API] Datos incompletos:", { hasEmail: !!body?.email, hasToken: !!body?.token });
      return NextResponse.json(
        { error: "Datos de verificación incompletos." },
        { status: 400 }
      );
    }

    const { email, token } = body;

    // CRÍTICO: Cliente Supabase vinculado a cookies (esto escribe las cookies de sesión)
    // En Next.js 16, cookies() NO es async en route handlers, se pasa directamente
    const supabase = createRouteHandlerClient({ cookies });

    console.log("[VerifyOTP API] Verificando OTP para:", email);

    // Verificar el código OTP en servidor
    const { data, error } = await supabase.auth.verifyOtp({
      type: "email",
      email,
      token,
    });

    if (error || !data.session) {
      console.error("[VerifyOTP API] Error al verificar OTP:", {
        error: error?.message,
        errorName: error?.name,
        hasData: !!data,
        hasSession: !!data?.session,
      });
      return NextResponse.json(
        {
          error:
            error?.message ||
            "El código no es válido o ha expirado. Por favor, inténtalo de nuevo.",
        },
        { status: 400 }
      );
    }

    console.log("[VerifyOTP API] Sesión creada:", {
      userId: data.session.user?.id,
      email: data.session.user?.email,
    });

    // IMPORTANTE:
    // createRouteHandlerClient + verifyOtp escriben las cookies de sesión
    // directamente asociadas a este dominio (pro.bookfast.es)
    // No hace falta llamar a setSession aquí, las cookies ya están escritas.

    return NextResponse.json({
      ok: true,
      user: {
        id: data.session.user?.id,
        email: data.session.user?.email,
      },
    });
  } catch (err: any) {
    console.error("[VerifyOTP API] Error inesperado:", {
      message: err?.message,
      stack: err?.stack,
      name: err?.name,
    });
    return NextResponse.json(
      {
        error: err?.message || "Error inesperado al verificar el código. Por favor, inténtalo de nuevo.",
      },
      { status: 500 }
    );
  }
}

