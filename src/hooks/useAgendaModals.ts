import { useState } from "react";
import { Booking, CalendarSlot } from "@/types/agenda";

/**
 * Hook para centralizar el estado de todos los modales de la Agenda
 * 
 * Gestiona:
 * - Modal de nueva reserva / edición
 * - Modal de bloqueo de staff
 * - Panel de detalles de reserva
 * - Slots y bookings seleccionados
 */
export function useAgendaModals() {
  // Estados de visibilidad de modales
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [showBookingDetail, setShowBookingDetail] = useState(false);

  // Estados de selección
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  // Funciones auxiliares para abrir modales con configuración

  /**
   * Abre el modal de nueva reserva para un slot específico
   */
  const openNewBookingModal = (slot: CalendarSlot) => {
    setSelectedSlot(slot);
    setShowNewBookingModal(true);
    setEditingBooking(null);
  };

  /**
   * Abre el modal de nueva reserva en modo edición
   */
  const openEditBookingModal = (booking: Booking) => {
    setEditingBooking(booking);
    setShowNewBookingModal(true);
  };

  /**
   * Abre el modal de bloqueo de staff
   */
  const openBlockingModal = (slot: CalendarSlot, type?: "block" | "absence" | "vacation") => {
    setSelectedSlot(type ? { ...slot, type } : slot);
    setShowBlockingModal(true);
  };

  /**
   * Abre el panel de detalles de una reserva
   */
  const openBookingDetail = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowBookingDetail(true);
  };

  /**
   * Cierra todos los modales y limpia la selección
   */
  const closeAllModals = () => {
    setShowNewBookingModal(false);
    setShowBlockingModal(false);
    setShowBookingDetail(false);
    setEditingBooking(null);
    setSelectedBooking(null);
    setSelectedSlot(null);
  };

  /**
   * Cierra el modal de nueva reserva
   */
  const closeNewBookingModal = () => {
    setShowNewBookingModal(false);
    setEditingBooking(null);
    setSelectedSlot(null);
  };

  /**
   * Cierra el modal de bloqueo
   */
  const closeBlockingModal = () => {
    setShowBlockingModal(false);
    setSelectedSlot(null);
  };

  /**
   * Cierra el panel de detalles
   */
  const closeBookingDetail = () => {
    setShowBookingDetail(false);
    setSelectedBooking(null);
  };

  return {
    // Estados de visibilidad
    showNewBookingModal,
    showBlockingModal,
    showBookingDetail,
    
    // Estados de selección
    editingBooking,
    selectedBooking,
    selectedSlot,
    
    // Setters directos (para casos especiales)
    setShowNewBookingModal,
    setShowBlockingModal,
    setShowBookingDetail,
    setEditingBooking,
    setSelectedBooking,
    setSelectedSlot,
    
    // Funciones auxiliares
    openNewBookingModal,
    openEditBookingModal,
    openBlockingModal,
    openBookingDetail,
    closeAllModals,
    closeNewBookingModal,
    closeBlockingModal,
    closeBookingDetail,
  };
}
