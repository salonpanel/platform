"use client";

import { useEffect, useState } from "react";
import { NewBookingModal } from "@/components/calendar/NewBookingModal";
import { useBookingModal } from "@/contexts/BookingModalContext";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/Toast";

type SaveBookingResult =
  | { ok: true; booking: any }
  | { ok: false; error: string };

interface BookingFormPayload {
  id?: string;
  customer_id: string;
  service_id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  status?: "pending" | "paid" | "completed" | "cancelled" | "no_show";
  internal_notes?: string | null;
  client_message?: string | null;
  is_highlighted?: boolean;
}

export function BookingCreateModal() {
  const { modalState, close } = useBookingModal();
  const { showToast } = useToast();
  const supabase = getSupabaseBrowser();

  // Estados locales para los datos necesarios
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (!modalState.isCreateOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Obtener tenant del usuario
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: membership } = await supabase
          .from("memberships")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!membership?.tenant_id) return;

        setTenantId(membership.tenant_id);

        // Cargar datos en paralelo
        const [servicesRes, staffRes, customersRes] = await Promise.all([
          supabase
            .from("services")
            .select("id, name, price_cents, duration_minutes, active")
            .eq("tenant_id", membership.tenant_id)
            .eq("active", true)
            .order("name"),
          supabase
            .from("staff")
            .select("id, name, color, active")
            .eq("tenant_id", membership.tenant_id)
            .eq("active", true)
            .order("name"),
          supabase
            .from("customers")
            .select("id, name, email, phone")
            .eq("tenant_id", membership.tenant_id)
            .order("name")
            .limit(100),
        ]);

        setServices(servicesRes.data || []);
        setStaff(staffRes.data || []);
        setCustomers(customersRes.data || []);
      } catch (error) {
        console.error("Error loading modal data:", error);
        showToast("Error al cargar datos", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [modalState.isCreateOpen, supabase, showToast]);

  const handleSave = async (bookingData: BookingFormPayload): Promise<SaveBookingResult> => {
    if (!tenantId) {
      return { ok: false, error: "Tenant ID no disponible" };
    }

    try {
      // Crear nuevo booking
      const bookingPayload = {
        tenant_id: tenantId,
        customer_id: bookingData.customer_id,
        service_id: bookingData.service_id,
        staff_id: bookingData.staff_id,
        starts_at: bookingData.starts_at,
        ends_at: bookingData.ends_at,
        status: bookingData.status || "pending",
        internal_notes: bookingData.internal_notes || null,
        client_message: bookingData.client_message || null,
        is_highlighted: bookingData.is_highlighted || false,
      };

      const { data: newBooking, error } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select()
        .single();

      if (error) {
        return { ok: false, error: error.message || "Error al crear la cita" };
      }

      return { ok: true, booking: newBooking };
    } catch (error: any) {
      console.error("Error al guardar cita:", error);
      return { ok: false, error: error.message || "Error al guardar la cita" };
    }
  };

  if (!modalState.isCreateOpen) return null;

  return (
    <NewBookingModal
      isOpen={modalState.isCreateOpen}
      onClose={close}
      onSave={handleSave}
      services={services}
      staff={staff}
      customers={customers}
      selectedDate={modalState.initialDate ? modalState.initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
      isLoading={loading}
      tenantId={tenantId ?? undefined}
    />
  );
}
