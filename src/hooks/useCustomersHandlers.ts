"use client";

import { useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/Toast";

export interface CustomerMutationPayload {
    id?: string; // If present, update; else create
    full_name: string;
    email?: string;
    phone?: string;
    segment?: string;
    notes?: string;
}

export function useCustomersHandlers({ tenantId, onAfterMutation }: { tenantId: string | null; onAfterMutation?: () => void }) {
    const supabase = getSupabaseBrowser();
    const { showToast } = useToast();

    const saveCustomer = useCallback(
        async (payload: CustomerMutationPayload) => {
            if (!tenantId) {
                showToast("Error: No se ha identificado la sede (Tenant ID)", "error");
                return { success: false };
            }

            try {
                let result;

                if (payload.id) {
                    // UPDATE
                    const { data, error } = await supabase.rpc("manage_update_customer", {
                        p_customer_id: payload.id,
                        p_tenant_id: tenantId,
                        p_full_name: payload.full_name,
                        p_email: payload.email || null,
                        p_phone: payload.phone || null,
                        p_segment: payload.segment || 'normal',
                        p_notes: payload.notes || null,
                    });

                    if (error) throw error;
                    result = data;
                } else {
                    // CREATE
                    const { data, error } = await supabase.rpc("manage_create_customer", {
                        p_tenant_id: tenantId,
                        p_full_name: payload.full_name,
                        p_email: payload.email || null,
                        p_phone: payload.phone || null,
                        p_segment: payload.segment || 'normal',
                        p_notes: payload.notes || null,
                    });

                    if (error) throw error;
                    result = data;
                }

                if (!result.success) {
                    showToast(result.error || "Error al guardar cliente", "error");
                    return { success: false, error: result.error };
                }

                showToast(payload.id ? "Cliente actualizado" : "Cliente creado correctamente", "success");
                if (onAfterMutation) onAfterMutation();
                return { success: true, customerId: result.customer_id };

            } catch (err: any) {
                console.error("Error in saveCustomer:", err);
                showToast(err.message || "Error de conexión", "error");
                return { success: false, error: err.message };
            }
        },
        [tenantId, supabase, showToast, onAfterMutation]
    );

    const deleteCustomers = useCallback(
        async (customerIds: string[]) => {
            if (!tenantId) return { success: false };

            try {
                const { data, error } = await supabase.rpc("manage_delete_customers", {
                    p_customer_ids: customerIds,
                    p_tenant_id: tenantId,
                });

                if (error) throw error;

                if (!data.success) {
                    showToast(data.error || "Error al eliminar clientes", "error");
                    return { success: false, error: data.error };
                }

                showToast(`${data.deleted_count} clientes eliminados`, "success");
                if (onAfterMutation) onAfterMutation();
                return { success: true, count: data.deleted_count };

            } catch (err: any) {
                console.error("Error in deleteCustomers:", err);
                showToast(err.message || "Error al eliminar", "error");
                return { success: false, error: err.message };
            }
        },
        [tenantId, supabase, showToast, onAfterMutation]
    );

    return {
        saveCustomer,
        deleteCustomers
    };
}
