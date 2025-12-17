import { getSupabaseBrowser } from './supabase/browser';
import { getSupabaseAdmin } from './supabase/admin';

// Compat: mantener las firmas existentes en el proyecto
export const supabaseBrowser = () => getSupabaseBrowser();
export const supabaseServer = () => getSupabaseAdmin();
