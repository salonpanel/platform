// app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.email || !body.token) {
      return NextResponse.json(
        { ok: false, error: "Datos de verificación incompletos." },
        { status: 400 }
      );
    }

    const email = String(body.email).toLowerCase().trim();
    const token = String(body.token).trim();

    // ✅ Patrón correcto en Next 16: cachear cookies() y pasar función que retorna Promise
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ 
      cookies: () => Promise.resolve(cookieStore) 
    });

    console.log("[VerifyOTP API] Verificando OTP para:", email);

    const { data, error } = await supabase.auth.verifyOtp({
      type: "email",
      email,
      token,
    });

    if (error || !data?.session) {
      console.error("[VerifyOTP API] Error al verificar OTP:", error);
      return NextResponse.json(
        {
          ok: false,
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

    // ⚠️ Importante:
    // - createRouteHandlerClient + verifyOtp escriben las cookies de sesión
    //   (sb-panel-auth-auth-token, sb-panel-auth-refresh-token, etc.)
    // - No hace falta hacer setSession manual ni devolver tokens.

    return NextResponse.json({
      ok: true,
      user: {
        id: data.session.user?.id,
        email: data.session.user?.email,
      },
    });
  } catch (err: any) {
    console.error("[VerifyOTP API] Error inesperado:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error inesperado en verificación OTP.",
      },
      { status: 500 }
    );
  }
}
