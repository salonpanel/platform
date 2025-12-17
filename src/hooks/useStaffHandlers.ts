import { useState } from "react";
import { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/ui";

type StaffSchedule = {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
};

type CreateStaffParams = {
    name: string;
    display_name?: string;
    weekly_hours?: number;
    user_id?: string | null;
    role?: string;
    schedules?: StaffSchedule[];
    service_ids?: string[];
};

type UpdateStaffParams = {
    id: string;
    name: string;
    display_name?: string;
    weekly_hours?: number;
    schedules?: StaffSchedule[];
    service_ids?: string[];
};

export function useStaffHandlers(
    supabase: SupabaseClient,
    tenantId: string | null,
    onSuccess?: () => void
) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const createStaff = async (params: CreateStaffParams) => {
        if (!tenantId) return;
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase.rpc("panel_manage_create_staff_v1", {
                p_tenant_id: tenantId,
                p_name: params.name,
                p_display_name: params.display_name,
                p_weekly_hours: params.weekly_hours,
                p_user_id: params.user_id,
                p_role: params.role,
                p_schedules: params.schedules || [],
                p_service_ids: params.service_ids || []
            });

            if (error) throw error;
            if (data?.status === "ERROR") throw new Error(data.error);

            toast.showToast({
                type: "success",
                title: "Staff creado",
                message: "El miembro del equipo se ha creado correctamente",
            });

            onSuccess?.();
            return data?.data;
        } catch (err: any) {
            console.error("Error creating staff:", err);
            toast.showToast({
                type: "error",
                title: "Error",
                message: err.message || "No se pudo crear el staff",
            });
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateStaff = async (params: UpdateStaffParams) => {
        if (!tenantId) return;
        setIsSubmitting(true);

        try {
            const { data, error } = await supabase.rpc("panel_manage_update_staff_v1", {
                p_staff_id: params.id,
                p_tenant_id: tenantId,
                p_name: params.name,
                p_display_name: params.display_name,
                p_weekly_hours: params.weekly_hours,
                p_schedules: params.schedules || [],
                p_service_ids: params.service_ids || []
            });

            if (error) throw error;
            if (data?.status === "ERROR") throw new Error(data.error);

            toast.showToast({
                type: "success",
                title: "Staff actualizado",
                message: "Los cambios se han guardado correctamente",
            });

            onSuccess?.();
        } catch (err: any) {
            console.error("Error updating staff:", err);
            toast.showToast({
                type: "error",
                title: "Error",
                message: err.message || "No se pudo actualizar el staff",
            });
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleActive = async (id: string, newActiveStatus: boolean) => {
        if (!tenantId) return;
        // Note: We don't set global isSubmitting here to allow optimistic UI or independent loaders if needed,
        // but usually it's fine.

        try {
            const { data, error } = await supabase.rpc("panel_manage_toggle_staff_active_v1", {
                p_staff_id: id,
                p_tenant_id: tenantId,
                p_active: newActiveStatus
            });

            if (error) throw error;
            if (data?.status === "ERROR") throw new Error(data.error);

            toast.showToast({
                type: "success",
                title: newActiveStatus ? "Staff activado" : "Staff desactivado",
                message: `El estado del staff se ha actualizado`,
            });

            onSuccess?.();
        } catch (err: any) {
            console.error("Error toggling staff:", err);
            toast.showToast({
                type: "error",
                title: "Error",
                message: err.message || "No se pudo cambiar el estado",
            });
        }
    };

    return {
        createStaff,
        updateStaff,
        toggleActive,
        isSubmitting
    };
}
