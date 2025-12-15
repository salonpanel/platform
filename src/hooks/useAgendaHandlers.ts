"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { Booking, BookingStatus } from "@/types/agenda";

export interface BookingMutationPayload {
  id?: string;
  customer_id: string;
  service_id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  status?: BookingStatus;
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
}

export interface BlockingMutationPayload {
  staff_id: string;
  start_at: string;
  end_at: string;
  type: "block" | "absence" | "vacation";
  reason: string;
  notes?: string | null;
}

export interface CheckConflictsPayload {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  exclude_booking_id?: string | null;
}

export type SaveBookingResult = { ok: true; booking: Booking } | { ok: false; error: string };
export type SaveBlockingResult = { ok: true; blockingId: string } | { ok: false; error: string };

interface UseAgendaHandlersOptions {
  tenantId?: string | null;
  onAfterMutation?: () => Promise<void> | void;
}

const normalizeResponse = (value: any) => {
  if (Array.isArray(value)) {
    return value[0] ?? {};
  }
  return value ?? {};
};

export function useAgendaHandlers({ tenantId, onAfterMutation }: UseAgendaHandlersOptions) {
  const supabase = getSupabaseBrowser();
  const { showToast } = useToast();

  const saveBooking = useCallback(
    async (input: BookingMutationPayload): Promise<SaveBookingResult> => {
      if (!tenantId) {
        const error = "Tenant no disponible";
        showToast(error, "error");
        return { ok: false, error };
      }

      const { data, error } = await supabase.rpc("create_booking_with_validation", {
        p_booking: { ...input, tenant_id: tenantId },
      });

      if (error) {
        const message = error.message || "No se pudo guardar la cita";
        showToast(message, "error");
        return { ok: false, error: message };
      }

      const response = normalizeResponse(data);
      if (response?.error_message) {
        showToast(response.error_message, "error");
        return { ok: false, error: response.error_message };
      }

      const booking = (response.booking ?? {
        ...input,
        id: response.booking_id ?? input.id ?? crypto.randomUUID(),
        tenant_id: tenantId,
      }) as Booking;

      showToast(input.id ? "Cita actualizada" : "Cita creada", "success");
      await onAfterMutation?.();
      return { ok: true, booking };
    },
    [tenantId, supabase, showToast, onAfterMutation]
  );

  const saveBlocking = useCallback(
    async (input: BlockingMutationPayload): Promise<SaveBlockingResult> => {
      if (!tenantId) {
        const error = "Tenant no disponible";
        showToast(error, "error");
        return { ok: false, error };
      }

      const { data, error } = await supabase.rpc("create_staff_blocking_with_validation", {
        p_block: { ...input, tenant_id: tenantId },
      });

      if (error) {
        const message = error.message || "No se pudo guardar el bloqueo";
        showToast(message, "error");
        return { ok: false, error: message };
      }

      const response = normalizeResponse(data);
      if (response?.error_message) {
        showToast(response.error_message, "error");
        return { ok: false, error: response.error_message };
      }

      const blockingId: string = response.blocking_id ?? response.blocking?.id ?? crypto.randomUUID();
      showToast("Bloqueo guardado", "success");
      await onAfterMutation?.();
      return { ok: true, blockingId };
    },
    [tenantId, supabase, showToast, onAfterMutation]
  );

  const checkConflicts = useCallback(
    async ({ staff_id, starts_at, ends_at, exclude_booking_id }: CheckConflictsPayload) => {
      if (!tenantId) {
        showToast("Tenant no disponible", "error");
        return [];
      }

      const { data, error } = await supabase.rpc("check_booking_conflicts", {
        p_tenant_id: tenantId,
        p_staff_id: staff_id,
        p_start_at: starts_at,
        p_end_at: ends_at,
        p_exclude_booking_id: exclude_booking_id ?? null,
      });

      if (error) {
        showToast(error.message || "No se pudo verificar conflictos", "error");
        return [];
      }

      return Array.isArray(data) ? data : [];
    },
    [tenantId, supabase, showToast]
  );

  const moveBooking = useCallback(
    async (booking: Booking, newStartsAt: string, newStaffId?: string) => {
      const durationMin = booking.service?.duration_min || 30;
      const start = new Date(newStartsAt);
      const end = new Date(start.getTime() + durationMin * 60000);

      return saveBooking({
        id: booking.id,
        customer_id: booking.customer_id!, // Assumes customer_id exists on booking object
        service_id: booking.service_id!,
        staff_id: newStaffId || booking.staff_id!,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: booking.status,
      });
    },
    [saveBooking]
  );

  const resizeBooking = useCallback(
    async (booking: Booking, newEndsAt: string) => {
      return saveBooking({
        id: booking.id,
        customer_id: booking.customer_id!,
        service_id: booking.service_id!,
        staff_id: booking.staff_id!,
        starts_at: booking.starts_at,
        ends_at: newEndsAt,
        status: booking.status,
      });
    },
    [saveBooking]
  );

  return { saveBooking, saveBlocking, checkConflicts, moveBooking, resizeBooking };
}
