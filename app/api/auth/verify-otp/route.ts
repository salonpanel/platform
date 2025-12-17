// app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();
    const token = body?.token?.trim();

    console.log("[VerifyOTP] Request recibido:", {
      email: email ? email.substring(0, 5) + "..." : "EMPTY",
      tokenLength: token?.length || 0,
      body,
    });

    if (!email || !token) {
      console.error("[VerifyOTP] Datos incompletos:", {
        hasEmail: !!email,
        hasToken: !!token,
        body,
      });
      return NextResponse.json(
        { ok: false, error: "Datos de verificación incompletos." },
        { status: 400 }
      );
    }

    // ❗ Next.js 16 → cookies() ES UNA PROMISE
    const cookieStore = await cookies();

    // ❗ Crea una respuesta base, que será usada para Set-Cookie
    const res = NextResponse.json({ ok: true });

    // ❗ createServerClient DEBE usar esta respuesta
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
              res.cookies.set(name, value, options);
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

    const { data, error } = await supabase.auth.verifyOtp({
      type: "email",
      email,
      token,
    });

    console.log("[VerifyOTP] Respuesta de Supabase:", {
      hasData: !!data,
      hasSession: !!data?.session,
      errorMessage: error?.message,
      errorStatus: error?.status,
      errorCode: error?.code,
      fullError: error,
    });

    if (error || !data?.session) {
      console.error("[VerifyOTP] FALLO - Error:", error?.message || "No hay sesión");
      return NextResponse.json(
        { ok: false, error: error?.message || "Código inválido." },
        { status: 400 }
      );
    }

    // ❗ Devuelve la MISMA respuesta con las cookies adjuntas
    return new NextResponse(
      JSON.stringify({
        ok: true,
        user: {
          id: data.session.user.id,
          email: data.session.user.email,
        },
      }),
      {
        status: 200,
        headers: res.headers, // → AQUÍ VAN LAS COOKIES
      }
    );

  } catch (err: any) {
    console.error("[VerifyOTP ERROR]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}
