import { SupabaseClient } from "@supabase/supabase-js";

export interface AuditMetadata {
  source?: string;
  field?: string;
  action?: string;
  tag?: string;
  count?: number;
  [key: string]: unknown;
}

export interface AuditOldData {
  is_vip?: boolean | null;
  is_banned?: boolean | null;
  marketing_opt_in?: boolean | null;
  tags?: string[];
  [key: string]: unknown;
}

export interface AuditNewData {
  is_vip?: boolean | null;
  is_banned?: boolean | null;
  marketing_opt_in?: boolean | null;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Registra un evento de auditoría en platform.audit_logs
 * @param supabase Cliente de Supabase
 * @param tenantId ID del tenant
 * @param userId ID del usuario que realiza la acción
 * @param action Tipo de acción (update_flags, bulk_update_flags, update_tags, etc.)
 * @param resourceId ID del recurso afectado (customer id)
 * @param oldData Estado anterior (opcional)
 * @param newData Estado nuevo (opcional)
 * @param metadata Información adicional (opcional)
 */
export async function logCustomerAudit(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  action: string,
  resourceId: string,
  oldData: AuditOldData | null = null,
  newData: AuditNewData | null = null,
  metadata: AuditMetadata | null = null
): Promise<void> {
  try {
    await supabase.schema("platform").rpc("log_audit", {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_action: action,
      p_resource_type: "customer",
      p_resource_id: resourceId,
      p_old_data: oldData as Record<string, unknown> | null,
      p_new_data: newData as Record<string, unknown> | null,
      p_metadata: metadata as Record<string, unknown> | null,
    });
  } catch (err) {
    console.warn("Error al registrar auditoría:", err);
    // No fallar la operación principal si falla la auditoría
  }
}

/**
 * Registra auditoría para múltiples clientes (acciones masivas)
 */
export async function logBulkCustomerAudit(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  action: string,
  resourceIds: string[],
  oldData: Record<string, AuditOldData> | null = null,
  newData: AuditNewData | null = null,
  metadata: AuditMetadata | null = null
): Promise<void> {
  if (resourceIds.length === 0) return;

  // Registrar auditoría para cada cliente afectado
  for (const resourceId of resourceIds) {
    const customerOldData = oldData?.[resourceId] || null;
    await logCustomerAudit(
      supabase,
      tenantId,
      userId,
      action,
      resourceId,
      customerOldData,
      newData,
      metadata
    );
  }
}

