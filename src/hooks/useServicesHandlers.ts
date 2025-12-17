"use client";

import { useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/Toast";
import type { PricingLevels } from "@/types/services";

export interface ServiceMutationPayload {
    id?: string;
    name: string;
    duration_min: number;
    price_cents: number;
    category?: string;
    buffer_min?: number;
    description?: string;
    active: boolean;
    pricing_levels?: PricingLevels;
}

export function useServicesHandlers({ tenantId, onAfterMutation }: { tenantId: string | null; onAfterMutation?: () => void }) {
    const supabase = getSupabaseBrowser();
    const { showToast } = useToast();

    const saveService = useCallback(
        async (payload: ServiceMutationPayload) => {
            if (!tenantId) {
                showToast("Error: No se ha identificado la sede", "error");
                return { success: false };
            }

            try {
                let result;

                if (payload.id) {
                    // UPDATE
                    const { data, error } = await supabase.rpc("manage_update_service", {
                        p_service_id: payload.id,
                        p_tenant_id: tenantId,
                        p_name: payload.name,
                        p_duration_min: payload.duration_min,
                        p_price_cents: payload.price_cents,
                        p_category: payload.category || 'General',
                        p_buffer_min: payload.buffer_min || 0,
                        p_description: payload.description || null,
                        p_active: payload.active,
                        p_pricing_levels: payload.pricing_levels || {}
                    });

                    if (error) throw error;
                    result = data;
                } else {
                    // CREATE
                    const { data, error } = await supabase.rpc("manage_create_service", {
                        p_tenant_id: tenantId,
                        p_name: payload.name,
                        p_duration_min: payload.duration_min,
                        p_price_cents: payload.price_cents,
                        p_category: payload.category || 'General',
                        p_buffer_min: payload.buffer_min || 0,
                        p_description: payload.description || null,
                        p_active: payload.active,
                        p_pricing_levels: payload.pricing_levels || {}
                    });

                    if (error) throw error;
                    result = data;
                }

                if (!result.success) {
                    showToast(result.error || "Error al guardar servicio", "error");
                    return { success: false, error: result.error };
                }

                showToast(payload.id ? "Servicio actualizado" : "Servicio creado", "success");
                if (onAfterMutation) onAfterMutation();
                return { success: true, serviceId: result.service_id };

            } catch (err: any) {
                console.error("Error in saveService:", err);
                showToast(err.message || "Error al guardar", "error");
                return { success: false, error: err.message };
            }
        },
        [tenantId, supabase, showToast, onAfterMutation]
    );

    const duplicateService = useCallback(async (serviceId: string) => {
        if (!tenantId) return { success: false };

        try {
            const { data, error } = await supabase.rpc("manage_duplicate_service", {
                p_service_id: serviceId,
                p_tenant_id: tenantId
            });

            if (error) throw error;
            if (!data.success) {
                showToast(data.error || "Error al duplicar", "error");
                return { success: false };
            }

            showToast("Servicio duplicado correctamente", "success");
            if (onAfterMutation) onAfterMutation();
            return { success: true, serviceId: data.service_id };
        } catch (err: any) {
            showToast(err.message, "error");
            return { success: false };
        }
    }, [tenantId, supabase, showToast, onAfterMutation]);

    const deleteService = useCallback(async (serviceId: string) => {
        if (!tenantId) return { success: false };

        try {
            const { data, error } = await supabase.rpc("manage_delete_service", {
                p_service_id: serviceId,
                p_tenant_id: tenantId
            });

            if (error) throw error;

            if (!data.success) {
                showToast(data.error, "error");
                return { success: false, error: data.error };
            }

            showToast("Servicio eliminado", "success");
            if (onAfterMutation) onAfterMutation();
            return { success: true };
        } catch (err: any) {
            showToast(err.message, "error");
            return { success: false };
        }
    }, [tenantId, supabase, showToast, onAfterMutation]);

    return {
        saveService,
        duplicateService,
        deleteService
    };
}
