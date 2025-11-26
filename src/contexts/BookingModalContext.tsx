"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useAgendaModals } from '@/hooks/useAgendaModals';

interface BookingModalState {
  isCreateOpen: boolean;
  isDetailOpen: boolean;
  bookingId?: string | null;
  initialDate?: Date;
}

interface BookingModalContextType {
  modalState: BookingModalState;
  openCreate: (initialDate?: Date) => void;
  openDetail: (bookingId: string) => void;
  close: () => void;
}

const BookingModalContext = createContext<BookingModalContextType | null>(null);

export function BookingModalProvider({ children }: { children: ReactNode }) {
  // Usar el hook unificado internamente
  const agendaModals = useAgendaModals();

  // Adaptar la interfaz del hook unificado al formato esperado por BookingModalContext
  const contextValue: BookingModalContextType = {
    modalState: {
      isCreateOpen: agendaModals.isCreateOpen,
      isDetailOpen: agendaModals.isDetailOpen,
      bookingId: agendaModals.bookingId,
      initialDate: agendaModals.initialDate,
    },
    openCreate: agendaModals.openCreate,
    openDetail: agendaModals.openDetail,
    close: agendaModals.close,
  };

  return (
    <BookingModalContext.Provider value={contextValue}>
      {children}
    </BookingModalContext.Provider>
  );
}

export function useBookingModal() {
  const context = useContext(BookingModalContext);
  if (!context) {
    throw new Error('useBookingModal must be used within a BookingModalProvider');
  }
  return context;
}
