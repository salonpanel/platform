'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Scissors,
  User,
  Phone,
  Mail,
  FileText,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { formatInTenantTz } from '@/lib/timezone';
import { Booking, BOOKING_STATUS_CONFIG } from '@/types/agenda';
import { cn } from '@/lib/utils';

export interface BookingSlidePanelProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (booking: Booking) => void;
  onCancel?: (bookingId: string) => void;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  timezone: string;
}

export function BookingSlidePanel({
  booking,
  isOpen,
  onClose,
  onEdit,
  onCancel,
  onStatusChange,
  timezone,
}: BookingSlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Cambiar estado de la reserva
  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;
    setStatusLoading(newStatus);
    try {
      const res = await fetch("/api/panel/booking-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, status: newStatus }),
      });
      if (res.ok) {
        onStatusChange?.(booking.id, newStatus);
        onClose();
      } else {
        const errorData = await res.json();
        console.error("[BookingSlidePanel] status change error:", errorData);
      }
    } catch (e) {
      console.error("[BookingSlidePanel] status change error:", e);
    } finally {
      setStatusLoading(null);
    }
  };

  // Mobile detection with state (triggers re-render for layout switch)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  // Reset cancel confirm when panel closes or booking changes
  useEffect(() => {
    if (!isOpen) setShowCancelConfirm(false);
  }, [isOpen, booking?.id]);

  // Body scroll lock — uses position:fixed trick for iOS Safari compatibility
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = panelRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        if (activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  // Auto-focus close button on open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const closeButton = panelRef.current.querySelector('button[aria-label="Close panel"]') as HTMLButtonElement;
      closeButton?.focus();
    }
  }, [isOpen]);

  if (!booking) return null;

  const formattedDate = formatInTenantTz(booking.starts_at, timezone, "EEEE, d 'de' MMMM");
  const formattedStartTime = formatInTenantTz(booking.starts_at, timezone, 'HH:mm');
  const formattedEndTime = formatInTenantTz(booking.ends_at, timezone, 'HH:mm');

  const statusConfig = BOOKING_STATUS_CONFIG[booking.status];
  const statusLabel = statusConfig?.label || booking.status;
  const statusLegendColor = statusConfig?.legendColor || '#9ca3af';

  const panelVariants = {
    desktop: {
      hidden: { x: 400, opacity: 0 },
      visible: { x: 0, opacity: 1 },
      exit: { x: 400, opacity: 0 },
    },
    mobile: {
      hidden: { y: '100%', opacity: 0 },
      visible: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 },
    },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const currentVariants = isMobile ? panelVariants.mobile : panelVariants.desktop;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[52] bg-black/20 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            ref={panelRef}
            variants={currentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className={cn(
              'fixed z-[56] flex flex-col',
              isMobile
                ? 'inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-2xl nav-inset-bottom'
                : 'right-0 top-0 h-full w-[400px] rounded-none'
            )}
            style={{
              background: `linear-gradient(135deg, rgba(30, 31, 35, 0.95) 0%, rgba(15, 16, 18, 0.98) 100%)`,
              backdropFilter: 'blur(20px)',
              borderLeft: isMobile ? 'none' : `1px solid var(--glass-border)`,
              borderTop: isMobile ? `1px solid var(--glass-border)` : 'none',
              boxShadow: `var(--shadow-premium)`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--glass-border-subtle)] px-6 py-4">
              <div className="flex-1 pr-4">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {booking.customer?.name || 'Sin cliente'}
                </h3>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${statusLegendColor}20`,
                    color: statusLegendColor,
                    border: `1px solid ${statusLegendColor}40`,
                  }}
                >
                  {statusLabel}
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  aria-label="Close panel"
                  className="ml-2 inline-flex items-center justify-center rounded-lg p-2 transition-colors"
                  style={{
                    color: 'var(--text-secondary)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                {/* Date & Time */}
                <div
                  className="flex items-start gap-4 rounded-lg p-4 transition-colors"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--glass-border-subtle)',
                  }}
                >
                  <div className="mt-1 flex-shrink-0">
                    <CalendarIcon size={20} style={{ color: 'var(--accent-blue)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider mb-1">
                      Fecha y hora
                    </p>
                    <p
                      className="text-sm font-medium capitalize"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {formattedDate}
                    </p>
                    <p
                      className="text-sm mt-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {formattedStartTime} – {formattedEndTime}
                    </p>
                  </div>
                </div>

                {/* Service */}
                {booking.service && (
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      <Scissors size={20} style={{ color: 'var(--accent-aqua)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider mb-1">
                        Servicio
                      </p>
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {booking.service.name}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {booking.service.duration_min} min
                        </span>
                        <span
                          className="font-semibold"
                          style={{ color: 'var(--accent-blue)' }}
                        >
                          {(booking.service.price_cents / 100).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Staff */}
                {booking.staff && (
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex-shrink-0">
                      <User size={20} style={{ color: 'var(--accent-aqua)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider mb-1">
                        Personal
                      </p>
                      <div className="flex items-center gap-2">
                        {booking.staff.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: booking.staff.color }}
                            aria-hidden="true"
                          />
                        )}
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {booking.staff.name}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Contact */}
                {(booking.customer?.phone || booking.customer?.email) && (
                  <div className="space-y-3">
                    {booking.customer.phone && (
                      <a
                        href={`tel:${booking.customer.phone}`}
                        className="flex items-start gap-4 p-3 rounded-lg transition-colors"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--glass-border-subtle)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        }}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <Phone size={16} style={{ color: 'var(--accent-blue)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider mb-1">
                            Teléfono
                          </p>
                          <p
                            className="text-sm font-medium"
                            style={{ color: 'var(--accent-blue)' }}
                          >
                            {booking.customer.phone}
                          </p>
                        </div>
                      </a>
                    )}

                    {booking.customer.email && (
                      <a
                        href={`mailto:${booking.customer.email}`}
                        className="flex items-start gap-4 p-3 rounded-lg transition-colors"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--glass-border-subtle)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        }}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <Mail size={16} style={{ color: 'var(--accent-blue)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p style={{ color: 'var(--text-tertiary)' }} className="text-xs uppercase tracking-wider mb-1">
                            Email
                          </p>
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--accent-blue)' }}
                          >
                            {booking.customer.email}
                          </p>
                        </div>
                      </a>
                    )}
                  </div>
                )}

                {/* Internal Notes */}
                {booking.internal_notes && (
                  <div
                    className="rounded-lg p-4 border"
                    style={{
                      backgroundColor: 'rgba(255, 214, 61, 0.08)',
                      borderColor: 'rgba(255, 214, 61, 0.3)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex-shrink-0">
                        <FileText size={16} style={{ color: 'rgba(255, 214, 61, 0.8)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs uppercase tracking-wider mb-2"
                          style={{ color: 'rgba(255, 214, 61, 0.7)' }}
                        >
                          Notas internas
                        </p>
                        <p
                          className="text-sm leading-relaxed break-words"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {booking.internal_notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--glass-border-subtle)] px-5 py-4 space-y-2" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>

              {/* Status Quick Actions — contextual based on current status */}
              {booking.status === "pending" && (
                <button
                  onClick={() => handleStatusChange("paid")}
                  disabled={statusLoading !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'rgba(79,227,193,0.15)', color: '#4FE3C1', border: '1px solid rgba(79,227,193,0.3)' }}
                  onMouseEnter={(e) => {
                    if (!statusLoading) e.currentTarget.style.backgroundColor = 'rgba(79,227,193,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(79,227,193,0.15)';
                  }}
                >
                  {statusLoading === "paid" ? "..." : "✓ Marcar como pagado"}
                </button>
              )}

              {booking.status === "paid" && (
                <button
                  onClick={() => handleStatusChange("completed")}
                  disabled={statusLoading !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'rgba(58,109,255,0.15)', color: 'var(--accent-blue)', border: '1px solid rgba(58,109,255,0.3)' }}
                  onMouseEnter={(e) => {
                    if (!statusLoading) e.currentTarget.style.backgroundColor = 'rgba(58,109,255,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(58,109,255,0.15)';
                  }}
                >
                  {statusLoading === "completed" ? "..." : "✓ Completar cita"}
                </button>
              )}

              {booking.status === "hold" && (
                <button
                  onClick={() => handleStatusChange("pending")}
                  disabled={statusLoading !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'rgba(255,193,7,0.12)', color: '#FFC107', border: '1px solid rgba(255,193,7,0.3)' }}
                  onMouseEnter={(e) => {
                    if (!statusLoading) e.currentTarget.style.backgroundColor = 'rgba(255,193,7,0.22)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255,193,7,0.12)';
                  }}
                >
                  {statusLoading === "pending" ? "..." : "Confirmar reserva"}
                </button>
              )}

              {/* Edit + Cancel row */}
              {!showCancelConfirm ? (
                <div className="flex gap-2.5">
                  <button
                    onClick={() => booking && onEdit?.(booking)}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{ color: 'var(--accent-blue)', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border-subtle)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                  >
                    Editar
                  </button>
                  {booking.status !== "cancelled" && booking.status !== "completed" && (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                      style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                    >
                      Cancelar cita
                    </button>
                  )}
                </div>
              ) : (
                /* Confirmación inline de cancelación */
                <div
                  className="rounded-lg p-3 space-y-2.5"
                  style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <p className="text-xs text-center font-medium" style={{ color: 'rgba(239,68,68,0.9)' }}>
                    ¿Confirmar cancelación de la cita?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border-subtle)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
                    >
                      No, volver
                    </button>
                    <button
                      onClick={() => handleStatusChange("cancelled")}
                      disabled={statusLoading !== null}
                      className="flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.4)' }}
                      onMouseEnter={(e) => { if (!statusLoading) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)'; }}
                    >
                      {statusLoading === "cancelled" ? "Cancelando..." : "Sí, cancelar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
