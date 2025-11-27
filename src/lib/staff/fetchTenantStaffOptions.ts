import { fetchTenantStaff } from "@/lib/tenant/tenantHelpers";

export interface StaffOption {
  id: string;
  name: string;
  color?: string | null;
}

/**
 * Fetches all staff members for a tenant, formatted for use in dropdowns/modals
 * Used by both Staff page and Services modal to ensure consistency
 */
export async function fetchTenantStaffOptions(tenantId: string): Promise<StaffOption[]> {
  const staff = await fetchTenantStaff(tenantId);

  return staff.map(staff => ({
    id: staff.id,
    name: staff.name,
    color: null, // TODO: Add color support if needed
  }));
}
