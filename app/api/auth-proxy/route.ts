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

  // CRÍTICO: Solo permitir paths de REST API o RPC para evitar proxying accidental de auth
  if (!path.startsWith("/rest/") && !path.startsWith("/rpc/")) {
    return NextResponse.json(
      { error: "Invalid path: only /rest/ and /rpc/ endpoints are allowed through proxy" },
      { status: 400 },
    );
  }

  // Si te llega solo /auth/v1/otp, completamos con SUPABASE_URL
  const targetUrl = path.startsWith("http")
    ? path
    : `${SUPABASE_URL}${path}`;

  // Preparamos headers a reenviar
  const headers = new Headers(req.headers);
  headers.set("apikey", SUPABASE_ANON_KEY || "");
  headers.set("x-client-info", "bookfast-proxy");
  // Importante: algunos headers no deben viajar tal cual
  headers.delete("host");
  headers.delete("content-length");

  // Para métodos con body, parseamos como JSON para asegurar formato correcto
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const jsonBody = await req.json();
      body = JSON.stringify(jsonBody);
      headers.set("content-type", "application/json");
    } catch (error) {
      // Si no es JSON válido, usar el body raw
      body = await req.text();
    }
  }

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

  // CRÍTICO: Reenviar cookies de sesión de Supabase al cliente
  const setCookieHeaders = upstreamResponse.headers.getSetCookie();
  if (setCookieHeaders && setCookieHeaders.length > 0) {
    // Next.js maneja múltiples Set-Cookie automáticamente
    setCookieHeaders.forEach(cookie => {
      responseHeaders.append("set-cookie", cookie);
    });
  }

  // Manejo especial para respuestas 204 (No Content) - no intentar parsear JSON
  if (upstreamResponse.status === 204) {
    return new NextResponse(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  // Si es un error, devolver JSON estructurado
  if (!upstreamResponse.ok) {
    return NextResponse.json(
      {
        error: "Upstream Supabase error",
        status: upstreamResponse.status,
        details: text || "No details provided"
      },
      { status: upstreamResponse.status }
    );
  }

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

export async function PATCH(req: NextRequest) {
  return handleProxy(req);
}

export async function PUT(req: NextRequest) {
  return handleProxy(req);
}

export async function DELETE(req: NextRequest) {
  return handleProxy(req);
}

export async function HEAD(req: NextRequest) {
  return handleProxy(req);
}

export async function OPTIONS(req: NextRequest) {
  return handleProxy(req);
}
