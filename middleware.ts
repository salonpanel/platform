import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isPanel = req.nextUrl.pathname.startsWith("/panel");
  const isAdmin = req.nextUrl.pathname.startsWith("/admin");

  // Proteger /panel (requiere sesión)
  if (isPanel && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Proteger /admin (requiere sesión + platform admin)
  if (isAdmin) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Verificar si es platform admin
    // Nota: En middleware no podemos usar cookies() directamente, usamos service role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar si es platform admin usando función RPC
    const { data: isAdmin, error } = await serviceRoleSupabase
      .rpc("check_platform_admin", { p_user_id: session.user.id })
      .single();

    if (error || !isAdmin) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = { matcher: ["/panel/:path*", "/admin/:path*"] };

