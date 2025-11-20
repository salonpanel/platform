import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

/**
 * GET /sitemap.xml
 * 
 * Genera el sitemap XML dinámicamente.
 * 
 * Por ahora, solo incluye:
 * - Portal público de reservas de cada tenant activo
 * 
 * TODO: Cuando se implemente el marketing site, añadir:
 * - bookfast.es/
 * - bookfast.es/pricing
 * - bookfast.es/blog/*
 * - etc.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const isProd = process.env.NODE_ENV === "production";
  const baseUrl = isProd ? "https://bookfast.es" : url.origin;

  try {
    // Obtener todos los tenants activos
    const supabase = supabaseServer();
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("slug")
      .eq("active", true)
      .not("slug", "is", null);

    if (error) {
      console.error("Error obteniendo tenants para sitemap:", error);
      // Devolver sitemap mínimo si hay error
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
        {
          headers: {
            "Content-Type": "application/xml",
          },
        }
      );
    }

    // Construir sitemap XML
    const urls: string[] = [];

    // Home de marketing (cuando esté implementado)
    urls.push(`  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);

    // Portal público de cada tenant
    if (tenants && tenants.length > 0) {
      tenants.forEach((tenant) => {
        if (tenant.slug) {
          const tenantUrl = isProd
            ? `https://${tenant.slug}.bookfast.es`
            : `${baseUrl}/r/${tenant.slug}`;
          urls.push(`  <url>
    <loc>${tenantUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
        }
      });
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (err) {
    console.error("Error generando sitemap:", err);
    // Devolver sitemap mínimo en caso de error
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
      {
        headers: {
          "Content-Type": "application/xml",
        },
      }
    );
  }
}


