// app/api/auth/send-otp-resend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/auth/send-otp-resend
 * 
 * Envía Magic Link token vía Resend (RÁPIDO: < 1 segundo)
 * Usa Supabase REST API directamente para obtener el token real
 * 
 * Request: { email: string }
 * Response: { ok: boolean, message?: string, error?: string }
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

    // Validar formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, error: "El formato del email no es válido." },
        { status: 400 }
      );
    }

    console.log(`[SendOTPResend] Iniciando flujo para: ${email}`);

    // 🔑 PASO 1: Llamar a Supabase REST API directamente para generar el token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const otpResponse = await fetch(
      `${supabaseUrl}/auth/v1/otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey!,
        },
        body: JSON.stringify({
          email,
          create_user: true,
        }),
      }
    );

    const otpData = await otpResponse.json();

    if (!otpResponse.ok) {
      console.error(`[SendOTPResend] Error de Supabase:`, otpData);

      // Manejar rate limits
      if (
        otpData?.error_description?.includes("you can only request this after")
      ) {
        const match = otpData.error_description.match(/(\d+)\s+seconds?/i);
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

      return NextResponse.json(
        {
          ok: false,
          error: otpData?.error_description || "No se pudo generar el código.",
        },
        { status: 500 }
      );
    }

    console.log(
      `[SendOTPResend] Token generado por Supabase para: ${email}`
    );

    // 🔑 PASO 2: Enviar email vía Resend (RÁPIDO)
    const { error: resendError } = await resend.emails.send({
      from: "noreply@bookfast.es",
      to: email,
      subject: "Tu código de acceso a BookFast Pro",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">¡Hola!</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hemos recibido una solicitud para acceder a tu cuenta de <strong>BookFast Pro</strong>.
            </p>

            <p style="margin: 30px 0; font-size: 12px; color: #999;">
              Tu código de acceso es válido por <strong>10 minutos</strong>. No lo compartas con nadie.
            </p>

            <div style="background: #f0f0f0; padding: 20px; border-radius: 6px; text-align: center; margin: 30px 0;">
              <p style="color: #999; font-size: 13px; margin: 0 0 10px 0;">Código de acceso:</p>
              <p style="font-size: 28px; letter-spacing: 3px; font-weight: bold; color: #1a1a1a; margin: 0; font-family: 'Courier New', monospace;">
                ${otpData?.token || "XXXXXXXX"}
              </p>
            </div>

            <ol style="color: #666; font-size: 14px; line-height: 1.8;">
              <li>Ve a <strong>https://pro.bookfast.es/login</strong></li>
              <li>Ingresa tu email: <strong>${email}</strong></li>
              <li>Copia el código anterior en el campo de verificación</li>
              <li>¡Listo! Podrás acceder a tu panel</li>
            </ol>

            <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
              Si no solicitaste este acceso, puedes ignorar este email de forma segura.
            </p>
          </div>
        </div>
      `,
    });

    if (resendError) {
      console.error(`[SendOTPResend] Error enviando email:`, resendError);
      return NextResponse.json(
        {
          ok: false,
          error: "Error al enviar el email. Intenta de nuevo.",
        },
        { status: 500 }
      );
    }

    console.log(`[SendOTPResend] ✅ Email enviado exitosamente a: ${email}`);

    return NextResponse.json({
      ok: true,
      message: `Se envió un código a ${email}. El código es válido por 10 minutos.`,
    });

  } catch (err: any) {
    console.error("[SendOTPResend ERROR]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Error inesperado.",
      },
      { status: 500 }
    );
  }
}

