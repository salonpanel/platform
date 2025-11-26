import { useState } from "react";
import { Booking, CalendarSlot } from "@/types/agenda";

/**
 * Hook unificado para centralizar el estado de todos los modales de la Agenda
 *
 * Gestiona:
 * - Modal de nueva reserva / edición
 * - Modal de bloqueo de staff
 * - Panel de detalles de reserva
 * - Estados de creación/detalle (compatibilidad con BookingModalContext)
 * - Slots y bookings seleccionados
 */
export function useAgendaModals() {
  // Estados de visibilidad de modales
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [showBookingDetail, setShowBookingDetail] = useState(false);

  // Estados de creación/detalle (compatibilidad con BookingModalContext)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [initialDate, setInitialDate] = useState<Date | undefined>(undefined);

  // Estados de selección
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);

  // Funciones auxiliares para abrir modales con configuración

  /**
   * Abre el modal de creación (compatibilidad con BookingModalContext)
   */
  const openCreate = (initialDate?: Date) => {
    setIsCreateOpen(true);
    setIsDetailOpen(false);
    setBookingId(null);
    setInitialDate(initialDate);
    setShowNewBookingModal(true);
  };

  /**
   * Abre el modal de detalle (compatibilidad con BookingModalContext)
   */
  const openDetail = (bookingId: string) => {
    setIsCreateOpen(false);
    setIsDetailOpen(true);
    setBookingId(bookingId);
    setInitialDate(undefined);
    setShowBookingDetail(true);

    // Buscar el booking por ID (esto debería hacerse en el componente padre)
    // Por ahora solo configuramos el estado
    setSelectedBooking({ id: bookingId } as Booking);
  };

  /**
   * Cierra modal de creación/detalle (compatibilidad con BookingModalContext)
   */
  const close = () => {
    setIsCreateOpen(false);
    setIsDetailOpen(false);
    setBookingId(null);
    setInitialDate(undefined);
    setShowNewBookingModal(false);
    setShowBookingDetail(false);
    setSelectedBooking(null);
  };
  const openNewBookingModal = (slot: CalendarSlot) => {
    setSelectedSlot(slot);
    setShowNewBookingModal(true);
    setEditingBooking(null);
  };

  /**
   * Función onSave para NewBookingModal - debe ser configurada por el componente padre
   * El componente padre debe pasar una función que implemente la lógica de guardado
   */
  const createOnSave = (saveBookingFn: (bookingData: any, forceOverlap?: boolean, successMessage?: string) => Promise<{ ok: true; booking: any } | { ok: false; error: string }>) => {
    return async (bookingData: any): Promise<{ ok: true; booking: any } | { ok: false; error: string }> => {
      return await saveBookingFn(bookingData, false);
    };
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
    setIsCreateOpen(false);
    setIsDetailOpen(false);
    setBookingId(null);
    setInitialDate(undefined);
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
    // Estados de visibilidad (Agenda)
    showNewBookingModal,
    showBlockingModal,
    showBookingDetail,

    // Estados de creación/detalle (BookingModalContext)
    isCreateOpen,
    isDetailOpen,
    bookingId,
    initialDate,

    // Estados de selección
    editingBooking,
    selectedBooking,
    selectedSlot,

    // Setters directos (para casos especiales)
    setShowNewBookingModal,
    setShowBlockingModal,
    setShowBookingDetail,
    setIsCreateOpen,
    setIsDetailOpen,
    setBookingId,
    setInitialDate,
    setEditingBooking,
    setSelectedBooking,
    setSelectedSlot,

    // Funciones auxiliares (Agenda)
    openNewBookingModal,
    openEditBookingModal,
    openBlockingModal,
    openBookingDetail,
    closeAllModals,
    closeNewBookingModal,
    closeBlockingModal,
    closeBookingDetail,

    // Funciones de BookingModalContext
    openCreate,
    openDetail,
    close,

    // Función helper para crear onSave estructurado
    createOnSave,

    // Estado computado para compatibilidad
    modalState: {
      isCreateOpen,
      isDetailOpen,
      bookingId,
      initialDate,
    },
  };
}
