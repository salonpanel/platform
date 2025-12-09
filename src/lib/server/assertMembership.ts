import { SupabaseClient } from '@supabase/supabase-js';

export interface MembershipResult {
  role: string;
  tenant_id: string;
}

/**
 * Centralized helper to assert user membership in a tenant
 * @param supabaseServer - Supabase server client
 * @param userId - User ID from session
 * @param tenantId - Tenant ID to check membership for
 * @returns MembershipResult with role and tenant_id
 * @throws Error with 403 if user is not a member of the tenant
 */
export async function assertMembership(
  supabaseServer: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<MembershipResult> {
  const { data, error } = await supabaseServer
    .from('memberships')
    .select('role, tenant_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    throw new Error('403: User is not a member of this tenant');
  }

  return data;
}