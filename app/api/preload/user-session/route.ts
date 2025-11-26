// app/api/preload/user-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 🔥 API de precarga progresiva de sesión de usuario
 * Se ejecuta durante el login para preparar datos antes de autenticación completa
 * NO requiere credenciales ya que es pre-autenticación
 */
export async function POST(req: NextRequest) {
  try {
    console.log("[PreloadUserSession] 🔥 Iniciando precarga de sesión...");

    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { ok: false, error: "Email requerido" },
        { status: 400 }
      );
    }

    const emailNormalized = email.toLowerCase().trim();

    // Crear cliente sin cookies ya que no estamos autenticados aún
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // No podemos setear cookies aquí
          },
        },
      }
    );

    // 🔥 PREPARACIÓN LIGERA: Solo verificar si el usuario existe
    // Esto nos permite saber si es un usuario válido sin cargar datos sensibles
    const { data: userCheck, error: checkError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", emailNormalized)
      .single();

    if (checkError || !userCheck) {
      console.log("[PreloadUserSession] ℹ️ Usuario no encontrado:", emailNormalized);
      return NextResponse.json({
        ok: false,
        error: "Usuario no encontrado",
        isNewUser: true
      }, { status: 404 });
    }

    console.log("[PreloadUserSession] ✅ Usuario encontrado, preparando tenant info...");

    // 🔥 PREPARACIÓN INTERMEDIA: Obtener info básica del tenant sin datos sensibles
    const { data: membership } = await supabase
      .from("memberships")
      .select("tenant_id")
      .eq("user_id", userCheck.id)
      .order("created_at", { ascending: true })
      .maybeSingle();

    if (!membership?.tenant_id) {
      console.log("[PreloadUserSession] ⚠️ Usuario sin membership activo");
      return NextResponse.json({
        ok: false,
        error: "Usuario sin barbería asignada",
        userId: userCheck.id
      }, { status: 404 });
    }

    // Obtener info básica del tenant (sin datos sensibles)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("id", membership.tenant_id)
      .single();

    if (!tenant) {
      console.log("[PreloadUserSession] ❌ Tenant no encontrado");
      return NextResponse.json({
        ok: false,
        error: "Barbería no encontrada",
        tenantId: membership.tenant_id
      }, { status: 404 });
    }

    console.log("[PreloadUserSession] ✅ Sesión preparada para:", {
      userId: userCheck.id,
      tenantId: tenant.id,
      tenantName: tenant.name
    });

    // 🔥 RESPONSE: Información preparada para el siguiente paso
    return NextResponse.json({
      ok: true,
      data: {
        userId: userCheck.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        // NO incluir datos sensibles aquí
      },
      message: "Sesión preparada para autenticación"
    });

  } catch (error: any) {
    console.error("[PreloadUserSession] ❌ Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno en precarga",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
