"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AgendaModal } from "@/components/calendar/AgendaModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Booking, Staff } from "@/types/agenda";
import type { Service as PlatformService } from "@/types/services";
import type { BookingMutationPayload, SaveBookingResult } from "@/hooks/useAgendaHandlers";

interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes?: string | null;
}

type CalendarService = Pick<PlatformService, "id" | "name" | "duration_min" | "price_cents" | "buffer_min">;

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: BookingMutationPayload) => Promise<SaveBookingResult>;
  services: CalendarService[];
  staff: Staff[];
  customers: CustomerLite[];
  selectedDate: string;
  selectedTime?: string;
  selectedEndTime?: string;
  selectedStaffId?: string;
  isLoading?: boolean;
  editingBooking?: Booking | null;
}

const DEFAULT_STATUS: Booking["status"] = "pending";

export function NewBookingModal({
  isOpen,
  onClose,
  onSave,
  services,
  staff,
  customers,
  selectedDate,
  selectedTime,
  selectedEndTime,
  selectedStaffId,
  isLoading = false,
  editingBooking = null,
}: NewBookingModalProps) {
  const { showToast, ToastComponent } = useToast();

  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState(selectedStaffId || "");
  const [bookingDate, setBookingDate] = useState(selectedDate);
  const [bookingTime, setBookingTime] = useState(selectedTime || "09:00");
  const [status, setStatus] = useState<Booking["status"]>(DEFAULT_STATUS);
  const [internalNotes, setInternalNotes] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingBooking) {
      setCustomerId(editingBooking.customer_id || "");
      setServiceId(editingBooking.service_id || "");
      setStaffId(editingBooking.staff_id || "");
      setStatus(editingBooking.status || DEFAULT_STATUS);
      setInternalNotes(editingBooking.internal_notes || "");
      setClientMessage(editingBooking.client_message || "");
      setIsHighlighted(Boolean(editingBooking.is_highlighted));

      const start = new Date(editingBooking.starts_at);
      setBookingDate(format(start, "yyyy-MM-dd"));
      setBookingTime(format(start, "HH:mm"));
    } else {
      setCustomerId("");
      setServiceId("");
      setStaffId(selectedStaffId || "");
      setStatus(DEFAULT_STATUS);
      setInternalNotes("");
      setClientMessage("");
      setIsHighlighted(false);
      setBookingDate(selectedDate);
      setBookingTime(selectedTime || "09:00");
    }
    setCustomerQuery("");
    setActiveTab("details");
  }, [isOpen, editingBooking, selectedDate, selectedTime, selectedStaffId]);

  const filteredCustomers = useMemo(() => {
    const term = customerQuery.trim().toLowerCase();
    if (!term) return customers.slice(0, 20);
    return customers
      .filter((customer) => {
        const values = [customer.name, customer.email, customer.phone].filter(Boolean) as string[];
        return values.some((value) => value.toLowerCase().includes(term));
      })
      .slice(0, 20);
  }, [customerQuery, customers]);

  const selectedService = services.find((svc) => svc.id === serviceId);
  const selectedStaff = staff.find((member) => member.id === staffId);
  const selectedCustomer = customers.find((c) => c.id === customerId.trim());

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

    const payload: BookingMutationPayload = {
      id: editingBooking?.id,
      customer_id: selectedCustomer.id,
      service_id: serviceId,
      staff_id: staffId,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      status,
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

  return (
    <>
      <AgendaModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingBooking ? "Editar cita" : "Nueva cita"}
        size="lg"
        context={{ type: "booking" }}
        actions={[
          {
            id: "save-booking",
            label: editingBooking ? "Actualizar" : "Guardar",
            variant: "primary",
            loading: isLoading,
            disabled: !customerId.trim() || !serviceId || !staffId || isLoading,
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
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "details" | "notes")}> 
            <TabsList>
              <TabsTrigger value="details">Detalles</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-white mb-2 flex justify-between">
                  Cliente
                  <span className="text-xs text-white/60">{filteredCustomers.length} resultados</span>
                </label>
                <Input
                  placeholder="Busca por nombre, email o teléfono"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  className="mb-3"
                />
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                >
                  <option value=" ">Selecciona un cliente...</option>
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {customer.phone || customer.email || "Sin contacto"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Booking["status"])}
                    className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                  >
                    {(["pending", "paid", "completed", "cancelled", "no_show", "hold"] as Booking["status"][]).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
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
        {ToastComponent}
      </AgendaModal>
    </>
  );
}

