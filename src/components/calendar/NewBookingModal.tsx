"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { format, addMinutes } from "date-fns";
import { Plus, Trash2, X, Search } from "lucide-react";
import { AgendaModal } from "@/components/calendar/AgendaModal";
import { CustomerQuickView } from "./CustomerQuickView";
import { Booking, Staff } from "@/types/agenda";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/Toast";
import { Tabs, TabsList, TabsTrigger, TabsContent, FormField, Input } from "@/components/ui";
import type { Service as PlatformService } from "@/types/services";
import { ModalActions, useModalActions, type ModalAction } from "@/components/agenda/ModalActions";

type CalendarService = Pick<
  PlatformService,
  "id" | "name" | "duration_min" | "price_cents" | "buffer_min"
>;

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  internal_notes?: string | null;
}

interface BookingService {
  id: string;
  service_id: string;
  staff_id: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  price_override?: number; // en céntimos, opcional
  discount?: number; // en céntimos, opcional
  is_free?: boolean;
}

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

type SaveBookingResult = { ok: true; booking: BookingFormPayload & { id: string } } | { ok: false; error: string };

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookingData: BookingFormPayload) => Promise<SaveBookingResult>;
  services: CalendarService[];
  staff: Staff[];
  customers: Customer[];
  selectedDate: string;
  selectedTime?: string;
  selectedEndTime?: string;
  selectedStaffId?: string;
  isLoading?: boolean;
  editingBooking?: Booking | null; // Cita existente para editar
  tenantId?: string; // Para crear nuevos clientes
}

// Booking type imported from @/types/agenda

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
  tenantId,
}: NewBookingModalProps) {
  const supabase = getSupabaseBrowser();
  const { showToast, ToastComponent } = useToast();
  const modalActions = useModalActions();

  // Estados del componente
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const customerInputRef = useRef<HTMLDivElement>(null);
  const [bookingServices, setBookingServices] = useState<BookingService[]>([]);
  const [bookingDate, setBookingDate] = useState(selectedDate);
  const [bookingTime, setBookingTime] = useState(selectedTime || "09:00");
  const [status, setStatus] = useState<"pending" | "paid" | "completed" | "cancelled" | "no_show">("pending");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [customerInternalNotes, setCustomerInternalNotes] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [activeTab, setActiveTab] = useState<"booking" | "notes">("booking");
  const [showCustomerView, setShowCustomerView] = useState(false);

  // Función handleSave
  const handleSave = async () => {
    // Validación básica
    if (!customerName.trim()) {
      showToast("El nombre del cliente es obligatorio", "error");
      return;
    }

    if (bookingServices.length === 0) {
      showToast("Debe seleccionar al menos un servicio", "error");
      return;
    }

    // Validar email si se proporciona
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      showToast("El formato del email no es válido", "error");
      return;
    }

    // Calcular endTime basado en el servicio seleccionado
    const selectedService = services.find(s => s.id === bookingServices[0].service_id);
    if (!selectedService) {
      showToast("Servicio no encontrado", "error");
      return;
    }

    const startDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const endDateTime = new Date(startDateTime.getTime() + selectedService.duration_min * 60000);

    // Validar que las fechas sean válidas
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      showToast("Las fechas proporcionadas no son válidas", "error");
      return;
    }

    if (endDateTime <= startDateTime) {
      showToast("La hora de fin debe ser posterior a la hora de inicio", "error");
      return;
    }

    try {
      // Lógica de cliente: buscar existente o crear nuevo
      let customerIdToUse = customerId;

      if (!customerIdToUse) {
        // Buscar cliente existente por email o teléfono
        let existingCustomer = null;

        if (customerEmail.trim()) {
          existingCustomer = customers.find(c => c.email?.toLowerCase() === customerEmail.trim().toLowerCase());
        }

        if (!existingCustomer && customerPhone.trim()) {
          existingCustomer = customers.find(c => c.phone === customerPhone.trim());
        }

        if (existingCustomer) {
          customerIdToUse = existingCustomer.id;

          // Actualizar datos del cliente si han cambiado
          const customerUpdates: any = {};
          if (customerName.trim() !== existingCustomer.name) {
            customerUpdates.name = customerName.trim();
          }
          if (customerPhone.trim() && customerPhone.trim() !== existingCustomer.phone) {
            customerUpdates.phone = customerPhone.trim();
          }
          if (customerEmail.trim() && customerEmail.trim() !== existingCustomer.email) {
            customerUpdates.email = customerEmail.trim();
          }
          if (customerNotes.trim() !== (existingCustomer.notes || "")) {
            customerUpdates.notes = customerNotes.trim() || null;
          }
          if (customerInternalNotes.trim() !== (existingCustomer.internal_notes || "")) {
            customerUpdates.internal_notes = customerInternalNotes.trim() || null;
          }

          if (Object.keys(customerUpdates).length > 0 && tenantId) {
            await supabase
              .from("customers")
              .update(customerUpdates)
              .eq("id", existingCustomer.id)
              .eq("tenant_id", tenantId);
          }
        } else {
          // Crear nuevo cliente
          if (!tenantId) {
            throw new Error("No se puede crear el cliente: tenant ID no disponible");
          }

          const newCustomerData = {
            tenant_id: tenantId,
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            email: customerEmail.trim() || null,
            notes: customerNotes.trim() || null,
            internal_notes: customerInternalNotes.trim() || null,
          };

          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert(newCustomerData)
            .select()
            .single();

          if (customerError) throw customerError;
          customerIdToUse = newCustomer.id;
        }
      }

      // Construir payload con solo el primer servicio (multi-service UI, single-service persistence)
      const bookingPayload: BookingFormPayload = {
        id: editingBooking?.id,
        customer_id: customerIdToUse,
        service_id: bookingServices[0].service_id,
        staff_id: bookingServices[0].staff_id,
        starts_at: startDateTime.toISOString(),
        ends_at: endDateTime.toISOString(),
        status: status,
        internal_notes: internalNotes.trim() || null,
        client_message: clientMessage.trim() || null,
        is_highlighted: isHighlighted,
      };

      // Llamar onSave
      const result = await onSave(bookingPayload);

      if (result.ok) {
        // Éxito - mostrar toast y cerrar modal
        showToast(
          editingBooking ? "Cita actualizada correctamente" : "Cita creada correctamente",
          "success"
        );
        onClose();
      } else {
        // Error - mostrar mensaje sin cerrar modal
        showToast(result.error, "error");
      }
    } catch (error: any) {
      console.error("Error al guardar cita:", error);
      showToast(error.message || "Error al guardar la cita", "error");
    }
  };

  // Crear acciones para el footer
  const footerActions: ModalAction[] = [
    modalActions.createSaveAction(handleSave, {
      label: editingBooking ? "Actualizar" : "Guardar",
      disabled: isLoading || bookingServices.length === 0,
      loading: isLoading,
    }),
  ];

  // Efectos y lógica del componente...

  // Cargar datos de booking cuando se está editando
  useEffect(() => {
    if (editingBooking && isOpen) {
      // Pre-llenar formulario con datos del booking existente
      const existingCustomer = customers.find((c) => c.id === editingBooking.customer_id);
      setCustomerId(editingBooking.customer_id || "");
      setCustomerName(existingCustomer?.name || "");
      setCustomerPhone(existingCustomer?.phone || "");
      setCustomerEmail(existingCustomer?.email || "");
      setCustomerNotes(existingCustomer?.notes || "");
      setCustomerInternalNotes(existingCustomer?.internal_notes || "");

      // Validar fecha de inicio
      if (editingBooking.starts_at) {
        const startsAt = new Date(editingBooking.starts_at);
        if (!isNaN(startsAt.getTime())) {
          setBookingDate(format(startsAt, "yyyy-MM-dd"));
          setBookingTime(format(startsAt, "HH:mm"));
        }
      }

      setStatus(editingBooking.status as "pending" | "paid" | "completed" | "cancelled" | "no_show" || "pending");
      setInternalNotes(editingBooking.internal_notes || "");
      setClientMessage(editingBooking.client_message || "");
      setIsHighlighted(editingBooking.is_highlighted || false);

      // Cargar servicio si existe
      if (editingBooking.service_id && editingBooking.staff_id) {
        setBookingServices([
          {
            id: `edit-${editingBooking.id}`,
            service_id: editingBooking.service_id,
            staff_id: editingBooking.staff_id,
            start_time: format(new Date(editingBooking.starts_at), "HH:mm"),
            end_time: format(new Date(editingBooking.ends_at), "HH:mm"),
          },
        ]);
      }
    } else if (!editingBooking && isOpen) {
      // Resetear formulario
      setCustomerId("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerNotes("");
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      setBookingServices([]);
      setBookingDate(selectedDate);
      setBookingTime(selectedTime || "09:00");
      setStatus("pending");
      setInternalNotes("");
      setClientMessage("");
      setIsHighlighted(false);
    }
  }, [editingBooking, isOpen, customers, selectedDate, selectedTime]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      <AgendaModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingBooking ? "Editar cita" : "Nueva cita"}
        size="lg"
        context={{ type: "booking" }}
        actions={footerActions}
        actionsConfig={{
          layout: "end",
          showCancel: true,
          onCancel: onClose,
          cancelLabel: "Descartar",
        }}
      >
        {/* Contenido del modal */}
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "booking" | "notes")}>
              <TabsList>
                <TabsTrigger value="booking">Cita</TabsTrigger>
                <TabsTrigger value="notes">Notas y datos</TabsTrigger>
              </TabsList>

              <TabsContent value="booking">
                <div className="space-y-6">
                {/* Cliente */}
                <div className="space-y-4">
                  <div ref={customerInputRef} className="relative">
                    <FormField label="Cliente" required>
                      <div className="relative">
                        <Input
                          value={customerName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setCustomerName(e.target.value);
                            setCustomerId("");
                          }}
                          placeholder="Escribe el nombre del cliente..."
                        />
                      </div>
                    </FormField>
                  </div>

                  {/* Teléfono y Email */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Teléfono" required helperText="Necesario para enviar notificaciones SMS">
                      <Input
                        type="tel"
                        value={customerPhone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerPhone(e.target.value)}
                        placeholder="Ej: 612345678"
                      />
                    </FormField>
                    <FormField label="Email" required helperText="Necesario para enviar confirmaciones por email">
                      <Input
                        type="email"
                        value={customerEmail}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value)}
                        placeholder="cliente@ejemplo.com"
                      />
                    </FormField>
                  </div>
                </div>

                {/* Fecha y hora */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                      Fecha <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                      Hora inicio <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                      className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white"
                    />
                  </div>
                </div>

                {/* Servicios */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                      Servicios <span className="text-[#EF4444]">*</span>
                    </label>
                    <button
                      onClick={() => {
                        // Agregar servicio
                        showToast("Funcionalidad pendiente", "info");
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[8px] flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Añadir servicio
                    </button>
                  </div>

                  {bookingServices.length === 0 ? (
                    <div className="p-6 text-center border-dashed border-white/10 rounded-[14px] bg-white/3">
                      <p className="text-sm text-[#9ca3af] mb-3 font-['Plus_Jakarta_Sans']">
                        No hay servicios añadidos
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Lista de servicios */}
                      <div className="p-4 bg-white/3 border border-white/5 rounded-[14px]">
                        <p className="text-sm text-white">Servicio agregado</p>
                      </div>
                    </div>
                  )}
                </div>
            </TabsContent>

            <TabsContent value="notes">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    Observaciones de la cita
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white"
                    placeholder="Observaciones internas..."
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Panel lateral */}
          <div className="space-y-4">
            <div className="p-4 rounded-[16px] border border-white/5 bg-white/3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#9ca3af]">Fecha seleccionada</p>
                  <p className="text-base font-semibold text-white">{bookingDate || "Sin fecha"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-[#9ca3af]">Horario</p>
                  <p className="text-base font-semibold text-white">{bookingTime || "Sin hora"}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-[16px] border border-white/5 bg-white/3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Estado de la cita
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="no_show">No se presentó</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        </div>
        {ToastComponent}
      </AgendaModal>

      {showCustomerView && selectedCustomer && (
        <CustomerQuickView
          customer={{
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            email: selectedCustomer.email,
            phone: selectedCustomer.phone,
          }}
          onClose={() => setShowCustomerView(false)}
          onCreateBooking={() => {
            setShowCustomerView(false);
          }}
        />
      )}
    </>
  );
}

