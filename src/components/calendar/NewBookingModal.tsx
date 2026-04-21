"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { AgendaModal } from "@/components/calendar/AgendaModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import type { Booking, Staff, BookingState, PaymentStatus } from "@/types/agenda";
import type { Service as PlatformService } from "@/types/services";
import type { BookingMutationPayload, SaveBookingResult } from "@/hooks/useAgendaHandlers";
import { useCustomerSearch, type CustomerLite } from "@/hooks/useCustomerSearch";
import { Loader2, Search, X, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

type CalendarService = Pick<PlatformService, "id" | "name" | "duration_min" | "price_cents" | "buffer_min">;

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: BookingMutationPayload) => Promise<SaveBookingResult>;
  services: CalendarService[];
  staff: Staff[];
  customers: CustomerLite[]; // Deprecated, kept for compat but ignored
  selectedDate: string;
  selectedTime?: string;
  selectedEndTime?: string;
  selectedStaffId?: string;
  isLoading?: boolean;
  editingBooking?: Booking | null;
  tenantId: string;
}

const DEFAULT_BOOKING_STATE: BookingState = "pending";
const DEFAULT_PAYMENT_STATUS: PaymentStatus = "unpaid";
const DEFAULT_DEPOSIT_CURRENCY = "EUR";

export function NewBookingModal({
  isOpen,
  onClose,
  onSave,
  services,
  staff,
  customers: _deprecatedCustomers,
  selectedDate,
  selectedTime,
  selectedEndTime,
  selectedStaffId,
  isLoading = false,
  editingBooking = null,
  tenantId
}: NewBookingModalProps) {
  const { showToast, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");

  // New Customer Search Logic
  const { query, setQuery, results, loading: searching, search } = useCustomerSearch(tenantId);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLite | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState(selectedStaffId || "");
  const [bookingDate, setBookingDate] = useState(selectedDate);
  const [bookingTime, setBookingTime] = useState(selectedTime || "09:00");
  const [bookingState, setBookingState] = useState<BookingState>(DEFAULT_BOOKING_STATE);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(DEFAULT_PAYMENT_STATUS);
  const [depositMode, setDepositMode] = useState<"amount" | "percent">("amount");
  const [depositAmountEUR, setDepositAmountEUR] = useState<string>("");
  const [depositPercent, setDepositPercent] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (editingBooking) {
      // Map existing customer to state
      if (editingBooking.customer) {
        setSelectedCustomer({
          id: editingBooking.customer.id!, // Assuming id is present in type
          name: editingBooking.customer.name,
          email: editingBooking.customer.email,
          phone: editingBooking.customer.phone
        });
      } else {
        setSelectedCustomer(null);
      }

      setServiceId(editingBooking.service_id || "");
      setStaffId(editingBooking.staff_id || "");
      setBookingState((editingBooking.booking_state as BookingState) || "confirmed");
      setPaymentStatus((editingBooking.payment_status as PaymentStatus) || (editingBooking.status === "paid" || editingBooking.status === "completed" ? "paid" : "unpaid"));
      const existingAmount = editingBooking.deposit_amount_cents != null ? (editingBooking.deposit_amount_cents / 100).toFixed(2) : "";
      const existingPercent = editingBooking.deposit_percent_bp != null ? (editingBooking.deposit_percent_bp / 100).toFixed(2) : "";
      if (existingAmount) {
        setDepositMode("amount");
        setDepositAmountEUR(existingAmount);
        setDepositPercent("");
      } else if (existingPercent) {
        setDepositMode("percent");
        setDepositPercent(existingPercent);
        setDepositAmountEUR("");
      } else {
        setDepositMode("amount");
        setDepositAmountEUR("");
        setDepositPercent("");
      }
      setInternalNotes(editingBooking.internal_notes || "");
      setClientMessage(editingBooking.client_message || "");
      setIsHighlighted(Boolean(editingBooking.is_highlighted));

      const start = new Date(editingBooking.starts_at);
      setBookingDate(format(start, "yyyy-MM-dd"));
      setBookingTime(format(start, "HH:mm"));
    } else {
      setSelectedCustomer(null);
      setServiceId("");
      setStaffId(selectedStaffId || "");
      setBookingState(DEFAULT_BOOKING_STATE);
      setPaymentStatus(DEFAULT_PAYMENT_STATUS);
      setDepositMode("amount");
      setDepositAmountEUR("");
      setDepositPercent("");
      setInternalNotes("");
      setClientMessage("");
      setIsHighlighted(false);
      setBookingDate(selectedDate);
      setBookingTime(selectedTime || "09:00");
    }
    setQuery("");
    setActiveTab("details");
  }, [isOpen, editingBooking, selectedDate, selectedTime, selectedStaffId]);

  const selectedService = services.find((svc) => svc.id === serviceId);
  const selectedStaff = staff.find((member) => member.id === staffId);

  const estimatedEndTime = useMemo(() => {
    if (selectedEndTime) return selectedEndTime;
    if (!serviceId) return bookingTime;
    const duration = selectedService?.duration_min ?? 30;
    const startDate = new Date(`${bookingDate}T${bookingTime}`);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    return format(endDate, "HH:mm");
  }, [bookingDate, bookingTime, serviceId, selectedEndTime, selectedService]);

  const handleSave = async () => {
    if (!selectedCustomer) {
      showToast("Selecciona un cliente", "error");
      return;
    }
    if (!serviceId) {
      showToast("Selecciona un servicio", "error");
      return;
    }
    if (!staffId) {
      showToast("Selecciona un profesional", "error");
      return;
    }

    const startDate = new Date(`${bookingDate}T${bookingTime}`);
    const endDate = new Date(`${bookingDate}T${estimatedEndTime}`);

    // Deposit validation + normalization
    let deposit_amount_cents: number | null = null;
    let deposit_percent_bp: number | null = null;

    if (paymentStatus === "deposit") {
      if (depositMode === "amount") {
        const raw = depositAmountEUR.replace(",", ".").trim();
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value <= 0) {
          showToast("Introduce un importe de adelanto válido (> 0€)", "error");
          return;
        }
        // Convert to cents safely
        deposit_amount_cents = Math.round(value * 100);
      } else {
        const raw = depositPercent.replace(",", ".").trim();
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value <= 0 || value > 100) {
          showToast("Introduce un porcentaje válido (0–100)", "error");
          return;
        }
        deposit_percent_bp = Math.round(value * 100); // basis points
      }
      // Mutual exclusivity
      if ((deposit_amount_cents == null) === (deposit_percent_bp == null)) {
        showToast("Define el adelanto como importe o porcentaje (solo uno)", "error");
        return;
      }
    }

    const payload: BookingMutationPayload = {
      id: editingBooking?.id,
      customer_id: selectedCustomer.id,
      service_id: serviceId,
      staff_id: staffId,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      booking_state: bookingState,
      payment_status: paymentStatus,
      deposit_amount_cents,
      deposit_percent_bp,
      deposit_currency: paymentStatus === "deposit" ? DEFAULT_DEPOSIT_CURRENCY : null,
      internal_notes: internalNotes.trim() || null,
      client_message: clientMessage.trim() || null,
      is_highlighted: isHighlighted,
    };

    const result = await onSave(payload);
    if (result.ok) {
      onClose();
      return;
    }
    showToast(result.error, "error");
  };

  const clearSelection = () => {
    setSelectedCustomer(null);
    setQuery("");
    setTimeout(() => {
      // Focus input logic if ref was attached to input
    }, 0);
  };

  const handleSelectCustomer = (c: CustomerLite) => {
    setSelectedCustomer(c);
    setQuery("");
    setIsSearchFocused(false);
  };

  return (
    <>
      <AgendaModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingBooking ? "Editar cita" : "Nueva cita"}
        size="lg"
        showMobileDrawer={true}
        drawerPosition="bottom"
        stickyFooter={true}
        context={{ type: "booking" }}
        actions={[
          {
            id: "save-booking",
            label: editingBooking ? "Actualizar" : "Guardar",
            variant: "primary",
            loading: isLoading,
            disabled: !selectedCustomer || !serviceId || !staffId || isLoading,
            onClick: handleSave,
          },
        ]}
        actionsConfig={{
          layout: "end",
          showCancel: true,
          onCancel: onClose,
          cancelLabel: "Cancelar",
        }}
      >
        <div className="px-4 sm:px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] pb-2">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "notes")}>
              <TabsList>
                <TabsTrigger value="details">Detalles</TabsTrigger>
                <TabsTrigger value="notes">Notas</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6">

                {/* ASYNC CUSTOMER COMBOBOX */}
                <div className="relative" ref={searchContainerRef}>
                  <label className="text-sm font-semibold text-white mb-2 block">
                    Cliente
                  </label>

                  {selectedCustomer ? (
                    <div className="flex items-center justify-between w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedCustomer.name}</p>
                          <p className="text-xs text-white/50">{selectedCustomer.phone || selectedCustomer.email || "Sin contacto"}</p>
                        </div>
                      </div>
                      <button onClick={clearSelection} className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                          placeholder="Buscar por nombre, email o teléfono..."
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setIsSearchFocused(true);
                          }}
                          onFocus={() => setIsSearchFocused(true)}
                          className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                        {searching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                        )}
                      </div>

                    {/* DROPDOWN RESULTS */}
                    {isSearchFocused && (query.trim().length > 0 || results.length > 0) && (
                      <div className="absolute z-[80] mt-2 w-full rounded-xl border border-white/10 bg-[#1b1d21] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {results.length > 0 ? (
                          <ul className="max-h-[240px] overflow-y-auto py-1">
                            {results.map((c) => (
                              <li key={c.id}>
                                <button
                                  onClick={() => handleSelectCustomer(c)}
                                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 group"
                                >
                                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white/70 transition-colors">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{c.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-white/40">
                                      {c.phone && <span>{c.phone}</span>}
                                      {c.phone && c.email && <span>•</span>}
                                      {c.email && <span>{c.email}</span>}
                                    </div>
                                  </div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="p-4 text-center text-sm text-white/40">
                            {searching ? "Buscando..." : "No se encontraron clientes"}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  )}
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Fecha</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Hora inicio</label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Servicio</label>
                  <select
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="">Selecciona un servicio...</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} · {svc.duration_min} min
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Profesional</label>
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="">Selecciona...</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Estado de la cita</label>
                  <select
                    value={bookingState}
                    onChange={(e) => setBookingState(e.target.value as BookingState)}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="in_progress">En curso</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="no_show">No se presentó</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Estado del pago</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  >
                    <option value="unpaid">No pagado</option>
                    <option value="deposit">Adelanto pagado</option>
                    <option value="paid">Pagado</option>
                  </select>
                </div>
                {paymentStatus === "deposit" && (
                  <div className="sm:col-span-2 rounded-[14px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Adelanto</p>
                        <p className="text-xs text-white/50">Define el adelanto como importe (€) o porcentaje (%)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDepositMode("amount")}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                            depositMode === "amount"
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-transparent border-white/10 text-white/60 hover:text-white"
                          )}
                        >
                          Importe
                        </button>
                        <button
                          type="button"
                          onClick={() => setDepositMode("percent")}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                            depositMode === "percent"
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-transparent border-white/10 text-white/60 hover:text-white"
                          )}
                        >
                          %
                        </button>
                      </div>
                    </div>

                    {depositMode === "amount" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-white/80 mb-1 block">Importe adelantado (€)</label>
                          <input
                            inputMode="decimal"
                            placeholder="Ej. 10,00"
                            value={depositAmountEUR}
                            onChange={(e) => {
                              setDepositAmountEUR(e.target.value);
                              setDepositPercent("");
                            }}
                            className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white placeholder:text-white/30"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-white/50">Moneda</div>
                          <div className="mt-1 rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white/70">
                            EUR
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-semibold text-white/80 mb-1 block">Porcentaje adelantado (%)</label>
                        <input
                          inputMode="decimal"
                          placeholder="Ej. 20"
                          value={depositPercent}
                          onChange={(e) => {
                            setDepositPercent(e.target.value);
                            setDepositAmountEUR("");
                          }}
                          className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white placeholder:text-white/30"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="highlighted"
                    checked={isHighlighted}
                    onChange={(e) => setIsHighlighted(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <label htmlFor="highlighted" className="text-sm text-white">
                    Marcar como destacada
                  </label>
                </div>
              </div>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-white mb-2">Notas internas</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-white mb-2">Mensaje al cliente</label>
                <textarea
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                />
              </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-4">
              <div className="p-4 rounded-[16px] border border-white/5 bg-white/5">
                <p className="text-xs uppercase text-white/60 mb-1">Resumen</p>
                <p className="text-lg font-semibold text-white">
                  {format(new Date(`${bookingDate}T${bookingTime}`), "EEEE d 'de' MMMM")}
                </p>
                <p className="text-sm text-white/70">
                  {bookingTime} · {estimatedEndTime}
                </p>
                {selectedService && (
                  <p className="text-sm text-white mt-3">
                    {selectedService.name} · {(selectedService.price_cents / 100).toFixed(2)} €
                  </p>
                )}
                {selectedStaff && (
                  <p className="text-sm text-white/80 mt-1">Profesional: {selectedStaff.name}</p>
                )}
                {selectedCustomer && (
                  <p className="text-xs text-white/60 mt-3">
                    Cliente: {selectedCustomer.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        {ToastComponent}
      </AgendaModal>
    </>
  );
}
