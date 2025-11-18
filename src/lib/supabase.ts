import { getSupabaseBrowser } from './supabase/browser';
import { getSupabaseServer } from './supabase/server';

// Compat: mantener las firmas existentes en el proyecto
export const supabaseBrowser = () => getSupabaseBrowser();
export const supabaseServer = () => getSupabaseServer();
