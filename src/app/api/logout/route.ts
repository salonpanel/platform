import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseServer } from "@/lib/supabase";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user?.id) {
    const sb = supabaseServer();
    await sb.from("auth_logs").insert({
      user_id: user.id,
      event: "logout",
      ip: getClientIp(request),
      user_agent: headers().get("user-agent") ?? undefined,
    });
  }

  return NextResponse.json({ ok: true });
}

