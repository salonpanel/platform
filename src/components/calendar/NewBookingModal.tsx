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
  tenant_id: string;
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

  // Estados del componente - Agregar ref para timeout de blur y estado de focus del input de cliente
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const customerInputRef = useRef<HTMLDivElement>(null);
  const customerBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [customerInputFocused, setCustomerInputFocused] = useState(false);
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
    if (!tenantId) {
      showToast("Error: tenant ID no disponible", "error");
      return;
    }

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
        tenant_id: tenantId!,
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

  // Cargar/Reset datos de booking sólo al abrir el modal o cambiar la cita en edición.
  // Evitamos dependencias que se actualizan en tiempo real (customers, selectedDate/Time)
  // para no resetear el formulario mientras el usuario escribe.
  useEffect(() => {
    if (!isOpen) return;

    if (editingBooking) {
      const existingCustomer = customers.find((c) => c.id === editingBooking.customer_id);
      setCustomerId(editingBooking.customer_id || "");
      setCustomerName(existingCustomer?.name || "");
      setCustomerPhone(existingCustomer?.phone || "");
      setCustomerEmail(existingCustomer?.email || "");
      setCustomerNotes(existingCustomer?.notes || "");
      setCustomerInternalNotes(existingCustomer?.internal_notes || "");

      if (editingBooking.starts_at) {
        const startsAt = new Date(editingBooking.starts_at);
        if (!isNaN(startsAt.getTime())) {
          setBookingDate(format(startsAt, "yyyy-MM-dd"));
          setBookingTime(format(startsAt, "HH:mm"));
        }
      }

      setStatus((editingBooking.status as "pending" | "paid" | "completed" | "cancelled" | "no_show") || "pending");
      setInternalNotes(editingBooking.internal_notes || "");
      setClientMessage(editingBooking.client_message || "");
      setIsHighlighted(editingBooking.is_highlighted || false);

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
    } else {
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
  }, [isOpen, editingBooking?.id]);

  // Función para filtrar sugerencias de cliente
  const updateCustomerSuggestions = useMemo(() => {
    return (searchText: string) => {
      if (searchText.length < 2) {
        setCustomerSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const filtered = customers.filter(customer => {
        const searchLower = searchText.toLowerCase();
        return (
          customer.name.toLowerCase().includes(searchLower) ||
          (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
          (customer.phone && customer.phone.includes(searchText))
        );
      }).slice(0, 5); // Limitar a 5 sugerencias

      setCustomerSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    };
  }, [customers]);

  // Función para seleccionar una sugerencia
  const selectCustomerSuggestion = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerEmail(customer.email || "");
    setCustomerNotes(customer.notes || "");
    setCustomerInternalNotes(customer.internal_notes || "");
    setShowSuggestions(false);
  };

  // Función para manejar focus del input de cliente
  const handleCustomerInputFocus = () => {
    setCustomerInputFocused(true);
    if (customerSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Función para manejar blur del input de cliente con delay
  const handleCustomerInputBlur = () => {
    setCustomerInputFocused(false);
    // Delay para permitir clicks en sugerencias
    customerBlurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  // Función para agregar/editar servicio
  const handleAddOrEditService = () => {
    if (bookingServices.length === 0) {
      const defaultService = services[0];
      const defaultStaff = selectedStaffId || staff[0]?.id;

      if (!defaultService || !defaultStaff) {
        showToast("No hay servicios o staff disponibles", "error");
        return;
      }

      setBookingServices([{
        id: `svc-${Date.now()}`,
        service_id: defaultService.id,
        staff_id: defaultStaff,
        start_time: bookingTime,
        end_time: format(
          addMinutes(new Date(`${bookingDate}T${bookingTime}`), defaultService.duration_min),
          "HH:mm"
        ),
      }]);
    }
    // If there is already one service, just keep it editable in the list below.
  };

  // Función para actualizar servicio
  const updateService = (serviceId: string, updates: Partial<BookingService>) => {
    setBookingServices(prev => prev.map(svc =>
      svc.id === serviceId ? { ...svc, ...updates } : svc
    ));
  };

  // Función para recalcular tiempo de fin cuando cambia servicio o hora
  const recalculateServiceEndTime = useMemo(() => {
    return (serviceId: string, startTime: string) => {
      const service = services.find(s => s.id === serviceId);
      if (!service) return startTime;
      return format(
        addMinutes(new Date(`${bookingDate}T${startTime}`), service.duration_min),
        "HH:mm"
      );
    };
  }, [services, bookingDate]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      <AgendaModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingBooking ? "Editar cita" : "Nueva cita"}
        size="lg"
        context={{ type: "booking" }}
        variant="modal"
        showMobileDrawer={true}
        drawerPosition="bottom"
        actions={footerActions}
        actionsConfig={{
          layout: "end",
          size: "md",
          showCancel: true,
          onCancel: onClose,
          cancelLabel: "Cancelar",
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
                            const value = e.target.value;
                            setCustomerName(value);
                            // Solo borrar customerId si el usuario está modificando el nombre de un cliente ya seleccionado
                            if (customerId && value !== customers.find(c => c.id === customerId)?.name) {
                              setCustomerId("");
                            }
                            updateCustomerSuggestions(value);
                          }}
                          onFocus={handleCustomerInputFocus}
                          onBlur={handleCustomerInputBlur}
                          placeholder="Escribe el nombre del cliente..."
                        />
                        {/* Dropdown de sugerencias */}
                        {showSuggestions && customerSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-[12px] border border-white/10 bg-[var(--glass-bg)] shadow-[var(--shadow-premium)] backdrop-blur-md">
                            {customerSuggestions.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onMouseDown={(e) => {
                                  // Prevent blur event when clicking suggestions
                                  e.preventDefault();
                                }}
                                onClick={() => {
                                  // Clear any pending blur timeout
                                  if (customerBlurTimeoutRef.current) {
                                    clearTimeout(customerBlurTimeoutRef.current);
                                    customerBlurTimeoutRef.current = null;
                                  }
                                  selectCustomerSuggestion(customer);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-white/5 focus:bg-white/5 transition-colors first:rounded-t-[12px] last:rounded-b-[12px] touch-manipulation"
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-medium text-white font-[var(--font-heading)]">
                                    {customer.name}
                                  </span>
                                  <span className="text-xs text-[var(--text-secondary)] font-[var(--font-body)]">
                                    {[customer.phone, customer.email].filter(Boolean).join(" · ") || "Sin contacto"}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormField>
                  </div>

                  {/* Teléfono y Email */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Teléfono" helperText="Úsalo para enviar notificaciones SMS si lo tienes.">
                      <Input
                        type="tel"
                        value={customerPhone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerPhone(e.target.value)}
                        placeholder="Ej: 612345678"
                      />
                    </FormField>
                    <FormField label="Email" helperText="Úsalo para enviar confirmaciones por email si lo tienes.">
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
                    {bookingServices.length === 0 && (
                      <button
                        onClick={handleAddOrEditService}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[8px] flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Añadir servicio
                      </button>
                    )}
                  </div>

                  {bookingServices.length === 0 ? (
                    <div className="p-6 text-center border-dashed border-white/10 rounded-[14px] bg-white/3">
                      <p className="text-sm text-[#9ca3af] mb-3 font-['Plus_Jakarta_Sans']">
                        No hay servicios añadidos
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 -mb-2">
                      {/* Lista de servicios */}
                      {bookingServices.map((service) => (
                        <div key={service.id} className="p-4 bg-white/3 border border-white/5 rounded-[14px] space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white font-[var(--font-heading)]">
                              Servicio
                            </h4>
                            <button
                              onClick={() => setBookingServices([])}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Eliminar servicio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Select de servicio */}
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-[var(--font-heading)]">
                              Servicio
                            </label>
                            <select
                              value={service.service_id}
                              onChange={(e) => {
                                const newServiceId = e.target.value;
                                const newEndTime = recalculateServiceEndTime(newServiceId, bookingTime);
                                updateService(service.id, {
                                  service_id: newServiceId,
                                  end_time: newEndTime
                                });
                              }}
                              className="w-full rounded-[10px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                            >
                              {services.map((svc) => (
                                <option key={svc.id} value={svc.id}>
                                  {svc.name} ({svc.duration_min} min - {(svc.price_cents / 100).toFixed(2)} €)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Select de staff */}
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-[var(--font-heading)]">
                              Profesional
                            </label>
                            <select
                              value={service.staff_id}
                              onChange={(e) => updateService(service.id, { staff_id: e.target.value })}
                              className="w-full rounded-[10px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
                            >
                              {staff.map((stf) => (
                                <option key={stf.id} value={stf.id}>
                                  {stf.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tiempos (solo lectura) */}
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-[var(--font-heading)]">
                                Inicio
                              </label>
                              <div className="text-sm text-white font-mono bg-white/5 px-3 py-2 rounded-lg">
                                {bookingTime}
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-[var(--font-heading)]">
                                Fin
                              </label>
                              <div className="text-sm text-white font-mono bg-white/5 px-3 py-2 rounded-lg">
                                {service.end_time}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
          </div>

          {/* Panel lateral */}
          <div className="space-y-4">
            <div className="p-4 rounded-[16px] border border-white/5 bg-white/3">
              <div className="space-y-3">
                {/* Fecha y hora formateada */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#9ca3af] font-[var(--font-heading)]">Fecha y hora</p>
                  <p className="text-base font-semibold text-white font-[var(--font-heading)]">
                    {format(new Date(`${bookingDate}T${bookingTime}`), "EEEE, d 'de' MMMM")}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] font-[var(--font-body)]">
                    {bookingTime}
                    {bookingServices.length > 0 && ` - ${bookingServices[0].end_time}`}
                  </p>
                </div>

                {/* Información del servicio si existe */}
                {bookingServices.length > 0 && (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-xs uppercase tracking-wider text-[#9ca3af] font-[var(--font-heading)] mb-2">Servicio</p>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white font-[var(--font-heading)]">
                        {services.find(s => s.id === bookingServices[0].service_id)?.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] font-[var(--font-body)]">
                        {services.find(s => s.id === bookingServices[0].service_id)?.duration_min} min · {(services.find(s => s.id === bookingServices[0].service_id)?.price_cents || 0) / 100} €
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] font-[var(--font-body)]">
                        con {staff.find(s => s.id === bookingServices[0].staff_id)?.name}
                      </p>
                    </div>
                  </div>
                )}
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

