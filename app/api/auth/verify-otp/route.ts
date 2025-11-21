// app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    console.log("[VerifyOTP API] Iniciando verificación OTP...");
    
    let body;
    try {
      body = await req.json();
      console.log("[VerifyOTP API] Body recibido:", { 
        hasEmail: !!body?.email, 
        hasToken: !!body?.token 
      });
    } catch (parseError: any) {
      console.error("[VerifyOTP API] Error parseando JSON:", parseError);
      return NextResponse.json(
        { ok: false, error: "Error al procesar la solicitud." },
        { status: 400 }
      );
    }

    if (!body || !body.email || !body.token) {
      console.error("[VerifyOTP API] Datos incompletos:", { 
        hasEmail: !!body?.email, 
        hasToken: !!body?.token 
      });
      return NextResponse.json(
        { ok: false, error: "Datos de verificación incompletos." },
        { status: 400 }
      );
    }

    const email = String(body.email).toLowerCase().trim();
    const token = String(body.token).trim();

    console.log("[VerifyOTP API] Creando cliente Supabase...");
    // ✅ Usar createServerClient de @supabase/ssr para Next.js 16
    // Este helper maneja correctamente las cookies en route handlers
    const cookieStore = await cookies();
    
    // Crear una respuesta vacía para establecer cookies
    const response = new NextResponse();
    
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
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );
    console.log("[VerifyOTP API] Cliente Supabase creado correctamente");

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
    // - createServerClient + verifyOtp escriben las cookies de sesión en response
    //   (sb-panel-auth-auth-token, sb-panel-auth-refresh-token, etc.)
    // - Devolver la respuesta con los headers de cookies establecidos

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: data.session.user?.id,
          email: data.session.user?.email,
        },
      },
      {
        headers: response.headers,
      }
    );
  } catch (err: any) {
    console.error("[VerifyOTP API] Error inesperado:", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      cause: err?.cause,
    });
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error inesperado en verificación OTP.",
      },
      { status: 500 }
    );
  }
}
