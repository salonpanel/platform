import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientErrorPayload = {
  message?: string;
  digest?: string;
  stack?: string;
  href?: string;
  pathname?: string;
  userAgent?: string;
  ts?: number;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ClientErrorPayload;
    // Keep logs small and avoid leaking sensitive data.
    console.error("[client-error]", {
      message: typeof payload?.message === "string" ? payload.message : undefined,
      digest: typeof payload?.digest === "string" ? payload.digest : undefined,
      pathname: typeof payload?.pathname === "string" ? payload.pathname : undefined,
      href: typeof payload?.href === "string" ? payload.href : undefined,
      userAgent: typeof payload?.userAgent === "string" ? payload.userAgent.slice(0, 160) : undefined,
      ts: typeof payload?.ts === "number" ? payload.ts : Date.now(),
      // stack is optional; can be large, so we trim hard.
      stack: typeof payload?.stack === "string" ? payload.stack.slice(0, 1000) : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[client-error] failed to parse", err?.message || err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

