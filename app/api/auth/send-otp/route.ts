// app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/auth/send-otp
 * 
 * Envía un token OTP/Magic Link a un email
 * - Usa Supabase auth.signInWithOtp() con type: "email"
 * - Maneja rate limiting centralizado
 * - Loguea intentos para debugging
 * 
 * Request:
 * {
 *   email: string (requerido)
 * }
 * 
 * Response:
 * {
 *   ok: boolean
 *   message?: string
 *   error?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "El email es requerido." },
        { status: 400 }
      );
    }

    // Validar formato básico de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, error: "El formato del email no es válido." },
        { status: 400 }
      );
    }

    // ✅ Crear cliente Supabase server-side
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
        cookieOptions: {
          name: "sb-panel-auth",
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        },
      }
    );

    console.log(`[SendOTP] Enviando OTP a: ${email}`);

    // ✅ Llamar a signInWithOtp con Magic Link (type: "email")
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        skipBrowserRedirect: true, // ✅ CRÍTICO en Next.js 16 SSR
      },
    });

    if (otpError) {
      console.error(`[SendOTP ERROR] ${email}:`, otpError.message);

      // Identificar tipo de error para respuesta más clara
      if (
        otpError.message?.includes("you can only request this after") ||
        otpError.message?.includes("rate limit") ||
        otpError.message?.includes("too many")
      ) {
        // Extraer segundos si está disponible
        const match = otpError.message.match(/(\d+)\s+seconds?/i);
        const seconds = match ? parseInt(match[1], 10) : 60;
        
        return NextResponse.json(
          {
            ok: false,
            error: `Por favor espera ${seconds} segundos antes de solicitar otro código.`,
            retryAfter: seconds,
          },
          { status: 429 }
        );
      }

      if (otpError.message?.includes("email")) {
        return NextResponse.json(
          { ok: false, error: "El email proporcionado no es válido." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: otpError.message || "No se pudo enviar el código. Intenta de nuevo.",
        },
        { status: 500 }
      );
    }

    console.log(`[SendOTP SUCCESS] OTP enviado a: ${email}`);

    return NextResponse.json({
      ok: true,
      message: `Se envió un código a ${email}. Expira en 10 minutos.`,
    });

  } catch (err: any) {
    console.error("[SendOTP EXCEPTION]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error inesperado al enviar el código.",
      },
      { status: 500 }
    );
  }
}
