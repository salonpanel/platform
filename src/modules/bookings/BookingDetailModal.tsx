"use client";

import { useEffect, useState } from "react";
import { BookingDetailPanel } from "@/components/calendar/BookingDetailPanel";
import { useBookingModal } from "@/contexts/BookingModalContext";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/Toast";

export function BookingDetailModal() {
  const { modalState, close } = useBookingModal();
  const { showToast } = useToast();
  const supabase = getSupabaseBrowser();

  // Estado local para la booking completa
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos de la booking cuando se abre el modal
  useEffect(() => {
    if (!modalState.isDetailOpen || !modalState.bookingId) return;

    const loadBooking = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("bookings")
          .select(`
            id,
            starts_at,
            ends_at,
            status,
            internal_notes,
            client_message,
            is_highlighted,
            customer:customers(id, name, email, phone),
            service:services(id, name, price_cents),
            staff:staff(id, name, color)
          `)
          .eq("id", modalState.bookingId)
          .single();

        if (error) throw error;

        setBooking(data);
      } catch (error) {
        console.error("Error loading booking:", error);
        showToast("Error al cargar la reserva", "error");
        close();
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [modalState.isDetailOpen, modalState.bookingId, supabase, showToast, close]);

  const handleEdit = () => {
    // Por ahora redirigir a agenda
    window.location.href = "/panel/agenda";
  };

  const handleDelete = async (bookingId: string) => {
    // Lógica de cancelar
    if (!confirm("¿Estás seguro de que quieres cancelar esta cita?")) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);

      if (error) throw error;

      showToast("Cita cancelada correctamente", "success");
      close();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      showToast("Error al cancelar la cita", "error");
    }
  };

  if (!modalState.isDetailOpen || !booking) return null;

  return (
    <BookingDetailPanel
      booking={booking}
      isOpen={modalState.isDetailOpen}
      onClose={close}
      onEdit={handleEdit}
      onDelete={handleDelete}
      timezone="Europe/Madrid" // TODO: obtener del tenant
    />
  );
}
