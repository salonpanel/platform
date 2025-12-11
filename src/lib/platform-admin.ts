import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Helper para acceder a tablas del schema platform
 * Nota: En producción, esto debería usar service_role o verificar permisos de platform admin
 */
export async function getPlatformClient() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  // TODO: Verificar que el usuario es platform admin
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) throw new Error('No autenticado');
  // const { data: platformUser } = await supabase
  //   .from('platform_users')
  //   .select('id')
  //   .eq('id', user.id)
  //   .single();
  // if (!platformUser) throw new Error('No autorizado');
  
  return supabase;
}

/**
 * Verificar si un usuario es platform admin
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  // En producción, verificarías en platform.platform_users
  // Por ahora, retornamos false (implementar según tu modelo de auth)
  const { data } = await supabase
    .rpc('is_platform_admin', { p_user_id: userId })
    .single();
  
  return data === true;
}









