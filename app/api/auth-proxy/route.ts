// app/api/auth-proxy/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function handleProxy(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json(
      { error: "Missing `path` query param" },
      { status: 400 },
    );
  }

  // Si te llega solo /auth/v1/otp, completamos con SUPABASE_URL
  const targetUrl = path.startsWith("http")
    ? path
    : `${SUPABASE_URL}${path}`;

  // Consumimos el body del request original
  const body = req.method === "GET" || req.method === "HEAD"
    ? undefined
    : await req.text();

  // Preparamos headers a reenviar
  const headers = new Headers(req.headers);
  headers.set("apikey", SUPABASE_ANON_KEY || "");
  headers.set("x-client-info", "bookfast-proxy");
  // Importante: algunos headers no deben viajar tal cual
  headers.delete("host");
  headers.delete("content-length");

  const upstreamResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  const text = await upstreamResponse.text();

  // Respuesta transparente hacia el cliente
  const responseHeaders = new Headers();
  const contentType =
    upstreamResponse.headers.get("content-type") || "application/json";
  responseHeaders.set("content-type", contentType);

  return new NextResponse(text, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

// Opcional: para CORS / preflight si lo necesitas
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
