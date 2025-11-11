import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "@/lib/supabase";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const allowedAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!allowedAppUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL no configurado." },
      { status: 500 }
    );
  }

  const allowedHost = new URL(allowedAppUrl).host;
  const originHeader = headers().get("origin");

  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== allowedHost) {
        return NextResponse.json(
          { error: "Host de origen no permitido." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Origen inválido." }, { status: 400 });
    }
  }

  if (url.host !== allowedHost) {
    return NextResponse.json(
      { error: "Host de callback inválido." },
      { status: 400 }
    );
  }

  const code = url.searchParams.get("code");

  if (code) {
    const supabaseClient = createRouteHandlerClient({ cookies });
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.json(
        { error: error.message ?? "No se pudo iniciar sesión." },
        { status: 400 }
      );
    }

    const session = data.session;
    if (session?.user?.id) {
      const sb = supabaseServer();
      await sb.from("auth_logs").insert({
        user_id: session.user.id,
        event: "login",
        ip: getClientIp(request),
        user_agent: headers().get("user-agent") ?? undefined,
      });
    }
  }

  return NextResponse.redirect(new URL("/panel", allowedAppUrl));
}

