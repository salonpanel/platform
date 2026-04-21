import { getSupabaseBrowser } from "@/lib/supabase/browser";

export interface StaffServiceRelation {
  staffId: string;
  serviceId: string;
}

/**
 * Updates staff-services relations for a specific staff member
 * Computes diff between current assignments and new assignments
 */
export async function updateStaffServices(
  tenantId: string,
  staffId: string,
  newServiceIds: string[]
): Promise<void> {
  const supabase = getSupabaseBrowser();

  // Get current relations
  const { data: currentRelations, error: fetchError } = await supabase
    .from("staff_provides_services")
    .select("service_id")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staffId);

  if (fetchError) {
    console.error("❌ updateStaffServices: Error fetching current relations:", fetchError);
    throw new Error(`Error fetching current relations: ${fetchError.message}`);
  }

  const currentServiceIds = (currentRelations || []).map(r => r.service_id);
  const currentSet = new Set(currentServiceIds);
  const newSet = new Set(newServiceIds);

  // Calculate additions and removals
  const toAdd = newServiceIds.filter(id => !currentSet.has(id));
  const toRemove = currentServiceIds.filter(id => !newSet.has(id));


  // Remove old relations
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("staff_provides_services")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("staff_id", staffId)
      .in("service_id", toRemove);

    if (deleteError) {
      console.error("❌ updateStaffServices: Error removing relations:", deleteError);
      throw new Error(`Error removing relations: ${deleteError.message}`);
    }
  }

  // Add new relations
  if (toAdd.length > 0) {
    const relationsToInsert = toAdd.map(serviceId => ({
      tenant_id: tenantId,
      staff_id: staffId,
      service_id: serviceId,
    }));

    const { error: insertError } = await supabase
      .from("staff_provides_services")
      .insert(relationsToInsert);

    if (insertError) {
      console.error("❌ updateStaffServices: Error adding relations:", insertError);
      throw new Error(`Error adding relations: ${insertError.message}`);
    }
  }

}

/**
 * Updates staff-services relations for a specific service
 * Computes diff between current assignments and new assignments
 */
export async function updateServiceStaff(
  tenantId: string,
  serviceId: string,
  newStaffIds: string[]
): Promise<void> {
  const supabase = getSupabaseBrowser();

  // Get current relations
  const { data: currentRelations, error: fetchError } = await supabase
    .from("staff_provides_services")
    .select("staff_id")
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId);

  if (fetchError) {
    console.error("❌ updateServiceStaff: Error fetching current relations:", fetchError);
    throw new Error(`Error fetching current relations: ${fetchError.message}`);
  }

  const currentStaffIds = (currentRelations || []).map(r => r.staff_id);
  const currentSet = new Set(currentStaffIds);
  const newSet = new Set(newStaffIds);

  // Calculate additions and removals
  const toAdd = newStaffIds.filter(id => !currentSet.has(id));
  const toRemove = currentStaffIds.filter(id => !newSet.has(id));


  // Remove old relations
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("staff_provides_services")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("service_id", serviceId)
      .in("staff_id", toRemove);

    if (deleteError) {
      console.error("[updateServiceStaff] Delete error:", {
        error: deleteError,
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint
      });
      throw new Error(`Error removing relations: ${deleteError.message}`);
    }
  }

  // Add new relations
  if (toAdd.length > 0) {
    const relationsToInsert = toAdd.map(staffId => ({
      tenant_id: tenantId,
      staff_id: staffId,
      service_id: serviceId,
    }));

    const { error: insertError } = await supabase
      .from("staff_provides_services")
      .insert(relationsToInsert);

    if (insertError) {
      console.error("❌ updateServiceStaff: Error adding relations:", insertError);
      throw new Error(`Error adding relations: ${insertError.message}`);
    }
  }

}

/**
 * Gets all services provided by a specific staff member
 */
export async function getStaffServices(staffId: string, tenantId: string): Promise<string[]> {
  const supabase = getSupabaseBrowser();

  const { data, error } = await supabase
    .from("staff_provides_services")
    .select("service_id")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staffId);

  if (error) {
    console.error("❌ getStaffServices: Error:", error);
    return [];
  }

  return (data || []).map(r => r.service_id);
}

/**
 * Gets all staff that provide a specific service
 */
export async function getServiceStaff(serviceId: string, tenantId: string): Promise<string[]> {
  const supabase = getSupabaseBrowser();

  const { data, error } = await supabase
    .from("staff_provides_services")
    .select("staff_id")
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId);

  if (error) {
    console.error("❌ getServiceStaff: Error:", error);
    return [];
  }

  return (data || []).map(r => r.staff_id);
}
