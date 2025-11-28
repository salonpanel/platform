// app/api/auth-proxy/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function handleProxy(req: NextRequest, path: string) {
  console.log(`[AuthProxy] ${req.method} request with path:`, path);

  if (!path) {
    console.log("[AuthProxy] ❌ Missing path parameter");
    return NextResponse.json(
      { error: "Missing path" },
      { status: 400 },
    );
  }

  // CRÍTICO: Solo permitir paths de REST API o RPC para evitar proxying accidental de auth
  if (!path.startsWith("/rest/") && !path.startsWith("/rpc/")) {
    console.log(`[AuthProxy] ❌ Invalid path: ${path} - does not start with /rest/ or /rpc/`);
    return NextResponse.json(
      { error: "Invalid path: only /rest/ and /rpc/ endpoints are allowed through proxy" },
      { status: 400 },
    );
  }

  console.log(`[AuthProxy] ✅ Path validation passed: ${path}`);

  // Construimos la URL final hacia Supabase
  const targetUrl = path.startsWith("http")
    ? path
    : `${SUPABASE_URL}${path}`;

  console.log(`[AuthProxy] Target URL: ${targetUrl}`);

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
    console.log(`[AuthProxy] Processing ${req.method} body...`);
    try {
      const jsonBody = await req.json();
      console.log(`[AuthProxy] Raw body:`, jsonBody);
      body = JSON.stringify(jsonBody);
      headers.set("content-type", "application/json");
      console.log(`[AuthProxy] Parsed JSON body for ${req.method}`);
    } catch (error) {
      console.log(`[AuthProxy] Failed to parse JSON body, using text:`, error);
      // Si no es JSON válido, usar el body raw
      body = await req.text();
    }
  }

  try {
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
      console.log(`[AuthProxy] ✅ Returning 204 No Content`);
      return new NextResponse(null, {
        status: 204,
        headers: responseHeaders,
      });
    }

    // Si es un error, devolver JSON estructurado
    if (!upstreamResponse.ok) {
      console.log(`[AuthProxy] ❌ Upstream error: ${upstreamResponse.status} - ${text}`);
      return NextResponse.json(
        {
          error: "Upstream Supabase error",
          status: upstreamResponse.status,
          details: text || "No details provided"
        },
        { status: upstreamResponse.status }
      );
    }

    console.log(`[AuthProxy] ✅ Success: ${upstreamResponse.status}`);
    return new NextResponse(text, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[AuthProxy] ❌ Fetch error:`, error);
    return NextResponse.json(
      {
        error: "Proxy fetch error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

function resolvePathFromRequest(req: NextRequest, pathSegments: string[] | undefined): string {
  const searchParams = req.nextUrl.searchParams;
  const encodedPath = searchParams.get("path");

  if (encodedPath) {
    try {
      const decoded = decodeURIComponent(encodedPath);
      return decoded;
    } catch (e) {
      // Si falla la decodificación, usar el valor tal cual para evitar 400 genéricos
      return encodedPath;
    }
  }

  const basePath = pathSegments && pathSegments.length > 0
    ? "/" + pathSegments.join("/")
    : "";

  const search = req.nextUrl.search;
  if (search && !search.startsWith("?path=")) {
    return `${basePath}${search}`;
  }

  return basePath;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvePathFromRequest(req, resolvedParams.path);
  return handleProxy(req, path);
}
