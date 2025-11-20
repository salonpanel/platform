/**
 * Utilidades Multi-Tenant - BookFast Platform
 * 
 * Funciones para trabajar con tenants y subdominios
 */

import { supabaseServer } from "@/lib/supabase";

/**
 * Obtiene un tenant por su subdominio (slug)
 * 
 * @param subdomain - Subdominio del tenant (ej: "barberstudio")
 * @returns Datos del tenant (id, slug) o null si no existe
 * 
 * @example
 * const tenant = await getTenantBySubdomain("barberstudio");
 * // { id: "uuid...", slug: "barberstudio" }
 */
export async function getTenantBySubdomain(subdomain: string): Promise<{ id: string; slug: string } | null> {
  if (!subdomain || subdomain.trim() === "") {
    return null;
  }

  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from("tenants")
      .select("id, slug")
      .eq("slug", subdomain.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error("[getTenantBySubdomain] Error consultando tenant:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      slug: data.slug,
    };
  } catch (err) {
    console.error("[getTenantBySubdomain] Error inesperado:", err);
    return null;
  }
}

/**
 * Verifica si un slug de tenant es válido y no está reservado
 * 
 * @param slug - Slug a verificar
 * @returns true si el slug es válido y disponible
 */
export function isValidTenantSlug(slug: string): boolean {
  if (!slug || slug.trim() === "") {
    return false;
  }

  // Validar formato: solo letras minúsculas, números y guiones
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    return false;
  }

  // No puede empezar o terminar con guión
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return false;
  }

  // No puede tener guiones consecutivos
  if (slug.includes("--")) {
    return false;
  }

  // Verificar subdominios reservados
  const reservedSubdomains = [
    "www",
    "pro",
    "admin",
    "api",
    "app",
    "www2",
    "mail",
    "ftp",
    "localhost",
    "staging",
    "dev",
    "test",
    "api",
    "cdn",
    "smtp",
  ];

  if (reservedSubdomains.includes(slug.toLowerCase())) {
    return false;
  }

  return true;
}

