import { NextResponse } from "next/server";

/**
 * GET /robots.txt
 * 
 * Genera el archivo robots.txt dinámicamente según el contexto.
 * 
 * URLs indexables:
 * - bookfast.es (marketing) - cuando esté implementado
 * - {tenant}.bookfast.es (portal público de reservas)
 * 
 * URLs NO indexables:
 * - pro.bookfast.es/panel/*
 * - admin.bookfast.es/admin/*
 * - /auth/*, /login, /logout
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = url.host;

  // Determinar contexto basado en el host
  const isPro = host.includes("pro.bookfast.es") || host.includes("pro.bookfast.es.localtest.me");
  const isAdmin = host.includes("admin.bookfast.es") || host.includes("admin.bookfast.es.localtest.me");
  const isMarketing = host === "bookfast.es" || host === "localhost:3000" || host.includes("bookfast.es.localtest.me");

  // Panel y admin: bloquear todo
  if (isPro || isAdmin) {
    return new NextResponse(
      `User-agent: *
Disallow: /`,
      {
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }

  // Marketing y portal público: permitir indexación
  // TODO: Cuando se implemente el marketing site, ajustar las rutas permitidas
  return new NextResponse(
    `User-agent: *
Allow: /
Disallow: /panel/
Disallow: /admin/
Disallow: /auth/
Disallow: /login
Disallow: /logout

Sitemap: ${url.origin}/sitemap.xml`,
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  );
}




