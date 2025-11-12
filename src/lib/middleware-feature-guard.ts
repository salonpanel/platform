import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasFeature } from "./platform-features";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Middleware para proteger endpoints por feature flags
 * Uso: export const middleware = withFeatureGuard('chat')(handler)
 */
export function withFeatureGuard(featureKey: string) {
  return function <T extends (...args: any[]) => Promise<Response>>(
    handler: T
  ): T {
    return (async (...args: Parameters<T>) => {
      const request = args[0] as NextRequest;

      // Obtener org_id del request (puede venir en body, query params o headers)
      let orgId: string | null = null;

      try {
        // Intentar obtener de query params
        const url = new URL(request.url);
        orgId = url.searchParams.get("org_id") || null;

        // Si no está en query, intentar del body (solo para POST/PUT/PATCH)
        if (!orgId && ["POST", "PUT", "PATCH"].includes(request.method)) {
          const body = await request.clone().json().catch(() => ({}));
          orgId = body.org_id || null;
        }

        // Si aún no hay org_id, intentar obtenerlo del usuario autenticado
        if (!orgId) {
          const supabase = createRouteHandlerClient({ cookies });
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("users")
              .select("tenant_id")
              .eq("id", user.id)
              .single();
            orgId = profile?.tenant_id || null;
          }
        }

        if (!orgId) {
          return NextResponse.json(
            { error: "No se pudo determinar la organización." },
            { status: 400 }
          );
        }

        // Verificar feature
        const hasAccess = await hasFeature(orgId, featureKey);
        if (!hasAccess) {
          return NextResponse.json(
            {
              error: `La funcionalidad '${featureKey}' no está disponible para tu plan.`,
            },
            { status: 403 }
          );
        }

        // Feature activo, continuar con el handler
        return handler(...args);
      } catch (error: any) {
        console.error("Feature guard error:", error);
        return NextResponse.json(
          { error: "Error al verificar permisos." },
          { status: 500 }
        );
      }
    }) as T;
  };
}

/**
 * Helper para verificar feature en un handler manualmente
 */
export async function requireFeature(
  orgId: string,
  featureKey: string
): Promise<void> {
  const hasAccess = await hasFeature(orgId, featureKey);
  if (!hasAccess) {
    throw new Error(
      `La funcionalidad '${featureKey}' no está disponible para tu plan.`
    );
  }
}

