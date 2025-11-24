import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseServer } from "./supabase";

/**
 * Verifica si un usuario es platform admin (cualquier rol activo)
 * Busca en platform.platform_users o verifica JWT claim
 */
export async function isPlatformAdmin(userId?: string): Promise<boolean> {
  if (!userId) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // No necesitamos setAll para solo lectura
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    userId = user.id;
  }

  const supabase = supabaseServer();
  
  // Usar función RPC para verificar platform admin
  const { data: isAdmin, error } = await supabase
    .rpc("check_platform_admin", { p_user_id: userId })
    .single();

  if (error) {
    console.error("Error checking platform admin:", error);
    return false;
  }

  return !!isAdmin;
}

/**
 * Verifica si un usuario tiene permisos de modificación (admin o support, no viewer)
 */
export async function canModifyPlatform(userId?: string): Promise<boolean> {
  if (!userId) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // No necesitamos setAll para solo lectura
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    userId = user.id;
  }

  const supabase = supabaseServer();
  
  // Verificar que tiene rol admin o support
  const { data: canModify, error } = await supabase
    .rpc("check_platform_admin_role", { 
      p_user_id: userId,
      p_allowed_roles: ["admin", "support"]
    })
    .single();

  if (error) {
    console.error("Error checking platform admin role:", error);
    return false;
  }

  return !!canModify;
}

/**
 * Obtiene el usuario platform admin actual
 */
export async function getPlatformAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // No necesitamos setAll para solo lectura
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const isAdmin = await isPlatformAdmin(user.id);
  if (!isAdmin) return null;

  const sb = supabaseServer();
  const { data } = await sb
    .from("platform_users")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

