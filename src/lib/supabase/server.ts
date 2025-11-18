import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * getSupabaseServer
 * Cliente server-side con service_role. Ignora RLS para uso en API Routes,
 * Server Actions, webhooks y cron jobs.
 */
export function getSupabaseServer(): SupabaseClient {
	return createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL as string,
		process.env.SUPABASE_SERVICE_ROLE_KEY as string
	);
}







