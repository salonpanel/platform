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
    media_url?: string;
    active: boolean;
    pricing_levels?: PricingLevels;
}

function normalizeServicesRpcError(err: any): string {
    const raw =
        (typeof err?.message === "string" && err.message) ||
        (typeof err?.error_description === "string" && err.error_description) ||
        (typeof err?.details === "string" && err.details) ||
        "";

    const code = typeof err?.code === "string" ? err.code : "";

    const lowered = raw.toLowerCase();
    if (raw === "access_denied" || lowered.includes("access_denied") || code === "42501") {
        return "No tienes permisos para realizar esta acción.";
    }
    if (raw === "not_authenticated" || lowered.includes("not_authenticated") || code === "28000") {
        return "Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.";
    }
    if (code === "23503") {
        return "No se puede eliminar porque tiene citas asociadas. Archívalo en su lugar.";
    }
    if (raw.trim().length > 0) return raw;
    return "Ha ocurrido un error inesperado.";
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
                        p_media_url: payload.media_url || null,
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
                        p_media_url: payload.media_url || null,
                        p_active: payload.active,
                        p_pricing_levels: payload.pricing_levels || {}
                    });

                    if (error) throw error;
                    result = data;
                }

                if (!result.success) {
                    showToast(normalizeServicesRpcError({ message: result.error }), "error");
                    return { success: false, error: result.error };
                }

                showToast(payload.id ? "Servicio actualizado" : "Servicio creado", "success");
                if (onAfterMutation) onAfterMutation();
                return { success: true, serviceId: result.service_id };

            } catch (err: any) {
                console.error("Error in saveService:", err);
                const msg = normalizeServicesRpcError(err);
                showToast(msg, "error");
                return { success: false, error: msg };
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
                showToast(normalizeServicesRpcError({ message: data.error }), "error");
                return { success: false };
            }

            showToast("Servicio duplicado correctamente", "success");
            if (onAfterMutation) onAfterMutation();
            return { success: true, serviceId: data.service_id };
        } catch (err: any) {
            showToast(normalizeServicesRpcError(err), "error");
            return { success: false, error: normalizeServicesRpcError(err) };
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
                const msg = normalizeServicesRpcError({ message: data.error });
                showToast(msg, "error");
                return { success: false, error: msg };
            }

            showToast("Servicio eliminado", "success");
            if (onAfterMutation) onAfterMutation();
            return { success: true };
        } catch (err: any) {
            const msg = normalizeServicesRpcError(err);
            showToast(msg, "error");
            return { success: false, error: msg };
        }
    }, [tenantId, supabase, showToast, onAfterMutation]);

    return {
        saveService,
        duplicateService,
        deleteService
    };
}
