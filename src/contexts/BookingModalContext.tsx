"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  const [modalState, setModalState] = useState<BookingModalState>({
    isCreateOpen: false,
    isDetailOpen: false,
    bookingId: null,
    initialDate: undefined,
  });

  const openCreate = (initialDate?: Date) => {
    setModalState({
      isCreateOpen: true,
      isDetailOpen: false,
      bookingId: null,
      initialDate,
    });
  };

  const openDetail = (bookingId: string) => {
    setModalState({
      isCreateOpen: false,
      isDetailOpen: true,
      bookingId,
      initialDate: undefined,
    });
  };

  const close = () => {
    setModalState({
      isCreateOpen: false,
      isDetailOpen: false,
      bookingId: null,
      initialDate: undefined,
    });
  };

  return (
    <BookingModalContext.Provider value={{
      modalState,
      openCreate,
      openDetail,
      close,
    }}>
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
