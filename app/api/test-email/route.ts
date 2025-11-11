import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const data = await resend.emails.send({
      from: 'SalonPanel <onboarding@resend.dev>',
      to: 'u0136986872@gmail.com',
      subject: 'Test desde Resend',
      html: '<strong>¡Correo de prueba enviado correctamente!</strong>',
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

