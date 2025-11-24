"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { format, addMinutes } from "date-fns";
import { Plus, Trash2, X, Search } from "lucide-react";
import { UiModal, UiButton, UiInput, UiField, UiBadge } from "@/components/ui/apple-ui-kit";
import { CustomerQuickView } from "./CustomerQuickView";
import { Booking, Staff } from "@/types/agenda";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/Toast";
import type { Service as PlatformService } from "@/types/services";

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

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookingData: any) => Promise<void>;
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

  // Cargar datos de booking cuando se está editando
  useEffect(() => {
    if (editingBooking && isOpen) {
      // Validar que las fechas sean válidas antes de formatear
      const startsAt = editingBooking.starts_at ? new Date(editingBooking.starts_at) : null;
      const endsAt = editingBooking.ends_at ? new Date(editingBooking.ends_at) : null;

      // Pre-llenar formulario con datos del booking existente
      const existingCustomer = customers.find((c) => c.id === editingBooking.customer_id);
      setCustomerId(editingBooking.customer_id || "");
      setCustomerName(existingCustomer?.name || "");
      setCustomerPhone(existingCustomer?.phone || "");
      setCustomerEmail(existingCustomer?.email || "");
      setCustomerNotes(existingCustomer?.notes || "");
      setCustomerInternalNotes(existingCustomer?.internal_notes || "");
      
      // Validar fecha de inicio
      if (startsAt && !isNaN(startsAt.getTime())) {
        setBookingDate(format(startsAt, "yyyy-MM-dd"));
        setBookingTime(format(startsAt, "HH:mm"));
      } else {
        // Si la fecha no es válida, usar la fecha seleccionada
        setBookingDate(selectedDate);
        setBookingTime(selectedTime || "09:00");
      }

      // Asegurar que el status sea válido
      const validStatus = editingBooking.status || "pending";
      setStatus(validStatus as "pending" | "paid" | "completed" | "cancelled" | "no_show");
      setInternalNotes(editingBooking.internal_notes || "");
      setClientMessage(editingBooking.client_message || "");
      setIsHighlighted(editingBooking.is_highlighted || false);

      // Cargar servicio si existe
      if (editingBooking.service_id && editingBooking.staff_id) {
        const service = services.find((s) => s.id === editingBooking.service_id);
        if (service && startsAt && endsAt && !isNaN(startsAt.getTime()) && !isNaN(endsAt.getTime())) {
          const startTime = format(startsAt, "HH:mm");
          const endTime = format(endsAt, "HH:mm");
          setBookingServices([
            {
              id: `edit-${editingBooking.id}`,
              service_id: editingBooking.service_id,
              staff_id: editingBooking.staff_id,
              start_time: startTime,
              end_time: endTime,
            },
          ]);
        }
      }
    } else if (!editingBooking && isOpen) {
      // Resetear formulario cuando no hay booking a editar
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
  }, [editingBooking, isOpen, services, selectedDate, selectedTime]);

  // Preconfiguración inteligente cuando cambia el slot seleccionado (solo si no estamos editando)
  useEffect(() => {
    if (editingBooking || !isOpen) return; // No preconfigurar si estamos editando

    if (selectedTime) {
      setBookingTime(selectedTime);
    }

    if (selectedDate) {
      setBookingDate(selectedDate);
    }

    if (bookingServices.length === 0) {
      const firstService = services[0];
      if (firstService && selectedTime) {
        try {
          const [hour, minute] = selectedTime.split(":").map(Number);
          if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            console.warn("Hora inválida:", selectedTime);
            return;
          }

          const startDate = new Date(`${selectedDate}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`);
          if (isNaN(startDate.getTime())) {
            console.warn("Fecha inválida:", selectedDate, selectedTime);
            return;
          }

          let endTimeValue = selectedEndTime;

          if (!endTimeValue) {
            const endDate = addMinutes(startDate, firstService.duration_min);
            if (isNaN(endDate.getTime())) {
              console.warn("Fecha de fin inválida después de sumar minutos");
              return;
            }
            endTimeValue = format(endDate, "HH:mm");
          }

          setBookingServices([
            {
              id: `temp-${Date.now()}`,
              service_id: firstService.id,
              staff_id: selectedStaffId || staff[0]?.id || "",
              start_time: selectedTime,
              end_time: endTimeValue || selectedTime,
            },
          ]);
        } catch (error) {
          console.error("Error al preconfigurar servicio:", error);
        }
      }
      return;
    }

    // Si ya hay servicios, actualizar staff/hora del primero
    setBookingServices((prev) =>
      prev.map((bs, idx) => {
        if (idx !== 0) return bs;
        return {
          ...bs,
          staff_id: selectedStaffId || bs.staff_id,
          ...(selectedTime ? { start_time: selectedTime } : {}),
          ...(selectedEndTime ? { end_time: selectedEndTime } : {}),
        };
      })
    );
  }, [selectedTime, selectedEndTime, selectedStaffId, selectedDate, services, staff, editingBooking, bookingServices.length, isOpen]);

  // Autocompletado de clientes
  useEffect(() => {
    // No mostrar sugerencias si ya hay un cliente seleccionado
    if (customerId) {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (customerName.trim().length > 0) {
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerName.toLowerCase()) ||
          (c.phone && c.phone.includes(customerName)) ||
          (c.email && c.email.toLowerCase().includes(customerName.toLowerCase()))
      );
      setCustomerSuggestions(filtered.slice(0, 5));
      setShowSuggestions(filtered.length > 0);
    } else {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
    }
  }, [customerName, customers, customerId]);

  // Cerrar sugerencias al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestions]);

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerEmail(customer.email || "");
    setCustomerNotes(customer.notes || "");
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  };

  const [status, setStatus] = useState<"pending" | "paid" | "completed" | "cancelled" | "no_show">("pending");
  const [internalNotes, setInternalNotes] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [customerInternalNotes, setCustomerInternalNotes] = useState("");
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [activeTab, setActiveTab] = useState<"booking" | "notes">("booking");
  const [showCustomerView, setShowCustomerView] = useState(false);

  // Calcular totales
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;

    bookingServices.forEach((bs) => {
      const service = services.find((s) => s.id === bs.service_id);
      if (service) {
        const price = bs.is_free ? 0 : (bs.price_override || service.price_cents);
        const discount = bs.discount || 0;
        subtotal += price;
        totalDiscount += discount;
      }
    });

    const total = subtotal - totalDiscount;

    return {
      subtotal,
      totalDiscount,
      total,
      deposit: 0,
      toPayToday: total,
    };
  }, [bookingServices, services]);

  const totalDurationMinutes = useMemo(() => {
    return bookingServices.reduce((acc, bs) => {
      const service = services.find((s) => s.id === bs.service_id);
      return acc + (service?.duration_min || 0);
    }, 0);
  }, [bookingServices, services]);

  // Calcular hora de fin basada en servicios
  const endTime = useMemo(() => {
    if (bookingServices.length === 0) return bookingTime;

    const totalMinutes = bookingServices.reduce((acc, bs) => {
      const service = services.find((s) => s.id === bs.service_id);
      return acc + (service?.duration_min || 0);
    }, 0);

    // Validar que bookingTime y bookingDate sean válidos
    if (!bookingTime || !bookingDate) return bookingTime || "09:00";
    
    const [hours, minutes] = bookingTime.split(":").map(Number);
    
    // Validar que hours y minutes sean números válidos
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return bookingTime;
    }

    try {
      const startDate = new Date(`${bookingDate}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`);
      
      // Validar que la fecha sea válida
      if (isNaN(startDate.getTime())) {
        return bookingTime;
      }

      const endDate = addMinutes(startDate, totalMinutes);
      
      // Validar que la fecha resultante sea válida
      if (isNaN(endDate.getTime())) {
        return bookingTime;
      }

      return format(endDate, "HH:mm");
    } catch (error) {
      console.error("Error calculando endTime:", error);
      return bookingTime;
    }
  }, [bookingServices, services, bookingTime, bookingDate]);

  const summaryDateLabel = useMemo(() => {
    if (!bookingDate) return "Sin fecha definida";
    const dateObj = new Date(`${bookingDate}T00:00:00`);
    if (isNaN(dateObj.getTime())) return bookingDate;
    return format(dateObj, "d 'de' MMMM yyyy");
  }, [bookingDate]);

  const summaryTimeLabel = bookingTime && endTime ? `${bookingTime} - ${endTime}` : "Horario sin definir";

  const assignedStaffName = useMemo(() => {
    const staffId = bookingServices[0]?.staff_id || selectedStaffId || "";
    if (!staffId) return null;
    const staffMember = staff.find((member) => member.id === staffId);
    return staffMember?.name || null;
  }, [bookingServices, selectedStaffId, staff]);

  const addService = () => {
    if (services.length === 0) return;

    const newService: BookingService = {
      id: `temp-${Date.now()}`,
      service_id: services[0].id,
      staff_id: selectedStaffId || staff[0]?.id || "",
      start_time: bookingTime,
      end_time: endTime,
    };

    setBookingServices([...bookingServices, newService]);
  };

  const removeService = (id: string) => {
    setBookingServices(bookingServices.filter((bs) => bs.id !== id));
  };

  const updateService = (id: string, updates: Partial<BookingService>) => {
    setBookingServices(
      bookingServices.map((bs) => (bs.id === id ? { ...bs, ...updates } : bs))
    );
  };

  const handleSave = async () => {
    if (!customerName.trim() || bookingServices.length === 0) {
      showToast("Completa el nombre del cliente y añade al menos un servicio.", "error");
      return;
    }

    // Validar email si se proporciona
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      showToast("Por favor, introduce un email válido.", "error");
      return;
    }

    let finalCustomerId = customerId;

    // Si no hay customerId pero hay nombre, crear o buscar cliente
    if (!finalCustomerId && customerName.trim() && tenantId) {
      try {
        // Buscar cliente existente por nombre, email o teléfono
        let existingCustomer = null;

        if (customerEmail) {
          const { data: emailMatch } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("email", customerEmail.trim())
            .maybeSingle();
          if (emailMatch) existingCustomer = emailMatch;
        }

        if (!existingCustomer && customerPhone) {
          const { data: phoneMatch } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("phone", customerPhone.trim())
            .maybeSingle();
          if (phoneMatch) existingCustomer = phoneMatch;
        }

        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        } else {
          // Crear nuevo cliente
          const { data: newCustomer, error: createError } = await supabase
            .from("customers")
            .insert({
              tenant_id: tenantId,
              name: customerName.trim(),
              email: customerEmail.trim() || null,
              phone: customerPhone.trim() || null,
              notes: customerNotes.trim() || null,
              internal_notes: customerInternalNotes.trim() || null,
            })
            .select("id")
            .single();

          if (createError) {
            throw new Error(`Error al crear cliente: ${createError.message}`);
          }

          if (!newCustomer) {
            throw new Error("No se pudo crear el cliente");
          }

          finalCustomerId = newCustomer.id;
        }
      } catch (error: any) {
        console.error("Error al crear/buscar cliente:", error);
        showToast(`Error al crear cliente: ${error?.message || "Error desconocido"}`, "error");
        return;
      }

      // Si hay un cliente seleccionado y se han modificado las notas, actualizarlas
      if (finalCustomerId && (customerNotes.trim() || customerInternalNotes.trim())) {
        try {
          await supabase
            .from("customers")
            .update({ 
              notes: customerNotes.trim() || null,
              internal_notes: customerInternalNotes.trim() || null
            })
            .eq("id", finalCustomerId);
        } catch (error: any) {
          console.error("Error al actualizar notas del cliente:", error);
          // No bloqueamos el guardado si falla la actualización de notas
        }
      }
    }

    if (!finalCustomerId) {
      showToast("Error: no se pudo identificar o crear el cliente.", "error");
      return;
    }

    // Validar que bookingDate, bookingTime y endTime sean válidos
    if (!bookingDate || !bookingTime || !endTime) {
      showToast("Completa correctamente la fecha y hora de la cita.", "error");
      return;
    }

    try {
      const [hours, minutes] = bookingTime.split(":").map(Number);
      const [endHours, endMinutes] = endTime.split(":").map(Number);

      // Validar que hours, minutes, endHours y endMinutes sean números válidos
      if (
        isNaN(hours) || isNaN(minutes) || 
        isNaN(endHours) || isNaN(endMinutes) ||
        hours < 0 || hours > 23 || minutes < 0 || minutes > 59 ||
        endHours < 0 || endHours > 23 || endMinutes < 0 || endMinutes > 59
      ) {
        showToast("Las horas deben estar en formato válido (HH:mm).", "error");
        return;
      }

      // Crear fechas con formato válido
      const startDateStr = `${bookingDate}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
      const endDateStr = `${bookingDate}T${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}:00`;

      const startsAtDate = new Date(startDateStr);
      const endsAtDate = new Date(endDateStr);

      // Validar que las fechas sean válidas
      if (isNaN(startsAtDate.getTime())) {
        showToast("La fecha y hora de inicio no son válidas.", "error");
        return;
      }

      if (isNaN(endsAtDate.getTime())) {
        showToast("La fecha y hora de fin no son válidas.", "error");
        return;
      }

      // Validar que la hora de fin sea posterior a la hora de inicio
      if (endsAtDate <= startsAtDate) {
        showToast("La hora de fin debe ser posterior a la hora de inicio.", "error");
        return;
      }

      const startsAt = startsAtDate.toISOString();
      const endsAt = endsAtDate.toISOString();

      // Por ahora, creamos una cita por cada servicio (simplificado)
      // En el futuro, podríamos crear una sola cita con múltiples servicios
      const bookingData = {
        ...(editingBooking && { id: editingBooking.id }), // Incluir ID si se está editando
        customer_id: finalCustomerId,
        service_id: bookingServices[0].service_id,
        staff_id: bookingServices[0].staff_id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: status,
        internal_notes: internalNotes,
        client_message: clientMessage,
        is_highlighted: isHighlighted,
      };

      await onSave(bookingData);
    } catch (error: any) {
      console.error("Error al guardar la cita:", error);
      const errorMessage = error?.message || error?.details || error?.hint || "Error al guardar la cita. Por favor, verifica que todos los campos sean correctos.";
      console.error("Detalles del error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error
      });
      showToast(errorMessage, "error");
    }
  };

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      <UiModal
        isOpen={isOpen}
        onClose={onClose}
        title={editingBooking ? "Editar cita" : "Nueva cita"}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-slate-400">
              {bookingServices.length > 0 && (
                <>
                  <div>Total: {(totals.total / 100).toFixed(2)} €</div>
                  {totals.totalDiscount > 0 && (
                    <div className="text-emerald-400">
                      Descuento: -{(totals.totalDiscount / 100).toFixed(2)} €
                    </div>
                  )}
                  <div className="font-semibold text-white">
                    A pagar hoy: {(totals.toPayToday / 100).toFixed(2)} €
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <UiButton
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Descartar
              </UiButton>
              <UiButton
                variant="primary"
                onClick={handleSave}
                disabled={isLoading || bookingServices.length === 0}
                loading={isLoading}
              >
                {editingBooking ? "Actualizar" : "Guardar"}
              </UiButton>
            </div>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div>
            <UiPillTabs
              value={activeTab}
              onChange={(value) => setActiveTab(value as any)}
              tabs={[
                { value: "booking", label: "Cita" },
                { value: "notes", label: "Notas y datos" }
              ]}
            />

        <TabsContent value="booking">
          <div className="space-y-6">
            {/* Cliente */}
            <div className="space-y-4">
              <div ref={customerInputRef} className="relative">
                <UiField
                  label="Cliente"
                  required
                >
                  <div className="relative">
                    <UiInput
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerId(""); // Limpiar ID si se escribe manualmente
                        // Mostrar sugerencias solo si hay texto y no hay cliente seleccionado
                        if (e.target.value.trim().length > 0 && !customerId) {
                          // El useEffect se encargará de mostrar las sugerencias
                        } else {
                          setShowSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        // Mostrar sugerencias al enfocar si hay texto y sugerencias disponibles
                        if (customerName.trim().length > 0 && customerSuggestions.length > 0 && !customerId) {
                          setShowSuggestions(true);
                        }
                      }}
                      placeholder="Escribe el nombre del cliente o selecciona uno existente..."
                      rightIcon={<Search className="h-4 w-4 text-slate-400" />}
                    />
                  </div>
                </UiField>
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-[#15171A] border border-white/10 rounded-[14px] shadow-[0px_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden">
                    {customerSuggestions.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                      >
                        <div className="font-semibold text-white font-['Plus_Jakarta_Sans']">{customer.name}</div>
                        <div className="text-xs text-[#9ca3af] flex items-center gap-3 mt-1 font-['Plus_Jakarta_Sans']">
                          {customer.phone && <span>📞 {customer.phone}</span>}
                          {customer.email && <span>📧 {customer.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {customerName && !customerId && (
                  <p className="mt-1 text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                    💡 Se creará un nuevo cliente si no seleccionas uno existente
                  </p>
                )}
              </div>

              {/* Teléfono y Email */}
              <div className="grid grid-cols-2 gap-4">
                <UiField
                  label="Teléfono"
                  required
                  hint="Necesario para enviar notificaciones SMS"
                >
                  <UiInput
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej: 612345678"
                  />
                </UiField>
                <UiField
                  label="Email"
                  required
                  hint="Necesario para enviar confirmaciones por email"
                >
                  <UiInput
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                  />
                </UiField>
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
                  className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
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
                  className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
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
                  onClick={addService}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[8px] transition-all duration-150 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']"
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
                  <button 
                    onClick={addService}
                    className="px-4 py-2 text-xs font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
                  >
                    + Añadir primer servicio
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookingServices.map((bs, index) => {
                    const service = services.find((s) => s.id === bs.service_id);
                    const serviceStaff = staff.find((s) => s.id === bs.staff_id);
                    const servicePrice = bs.is_free ? 0 : (bs.price_override || service?.price_cents || 0);
                    const finalPrice = servicePrice - (bs.discount || 0);

                    return (
                      <div key={bs.id} className="p-4 bg-white/3 border border-white/5 rounded-[14px]">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                              Servicio {index + 1}
                            </div>
                          </div>
                          <button
                            onClick={() => removeService(bs.id)}
                            className="text-[#EF4444] hover:text-[#EF4444]/80 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                              Servicio
                            </label>
                            <select
                              value={bs.service_id}
                              onChange={(e) => updateService(bs.id, { service_id: e.target.value })}
                              className="w-full rounded-[10px] border border-white/5 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
                            >
                              {services.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({(s.duration_min)} min, {(s.price_cents / 100).toFixed(2)} €)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                              Empleado
                            </label>
                            <select
                              value={bs.staff_id}
                              onChange={(e) => updateService(bs.id, { staff_id: e.target.value })}
                              className="w-full rounded-[10px] border border-white/5 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
                            >
                              {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                                Hora inicio
                              </label>
                              <input
                                type="time"
                                value={bs.start_time}
                                onChange={(e) => updateService(bs.id, { start_time: e.target.value })}
                                className="w-full rounded-[10px] border border-white/5 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">
                                Hora fin
                              </label>
                              <input
                                type="time"
                                value={bs.end_time}
                                onChange={(e) => updateService(bs.id, { end_time: e.target.value })}
                                className="w-full rounded-[10px] border border-white/5 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                            <div className="flex-1">
                              <div className="text-[10px] text-[#9ca3af] font-semibold uppercase tracking-wider font-['Plus_Jakarta_Sans']">Precio</div>
                              <div className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                                {(finalPrice / 100).toFixed(2)} €
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // TODO: Abrir modal de opciones (precio, descuento, gratis)
                                showToast("Pronto podrás editar precio y descuentos desde aquí.", "info");
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-[#d1d4dc] hover:text-white hover:bg-white/5 border border-white/5 rounded-[8px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
                            >
                              Opciones
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 resize-none font-['Plus_Jakarta_Sans']"
                placeholder="Observaciones internas sobre esta cita (solo visible para el personal)..."
              />
              <p className="mt-1 text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                Estas observaciones solo son visibles para el personal
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                Observaciones del cliente (públicas)
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 resize-none font-['Plus_Jakarta_Sans']"
                placeholder="Observaciones generales sobre el cliente..."
              />
              <p className="mt-1 text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                Estas observaciones se guardarán en la ficha del cliente
              </p>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300 font-['Plus_Jakarta_Sans']">
                <span>🤖</span>
                Notas internas para IA y staff
              </label>
              <textarea
                value={customerInternalNotes}
                onChange={(e) => setCustomerInternalNotes(e.target.value)}
                rows={4}
                className="w-full rounded-[10px] border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all duration-150 resize-none font-['Plus_Jakarta_Sans']"
                placeholder="Ej: Prefiere mañanas, alérgico a tintes, corte cada 3 semanas, usa barbero Juan..."
              />
              <p className="mt-1 text-xs text-amber-300/70 font-['Plus_Jakarta_Sans']">
                💡 La IA de voz usará estas notas para personalizar las llamadas y sugerir horarios óptimos
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                Mensaje al cliente
              </label>
              <textarea
                value={clientMessage}
                onChange={(e) => setClientMessage(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 resize-none font-['Plus_Jakarta_Sans']"
                placeholder="Mensaje personalizado para el cliente (se incluirá en el SMS/email de confirmación)..."
              />
              <p className="mt-1 text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                Este mensaje se añadirá al SMS/email de confirmación
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                Plantillas de mensaje
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Recuerda llegar 5 min antes",
                  "Trae el pelo limpio",
                  "Confirmación de cita",
                ].map((template) => (
                  <button
                    key={template}
                    onClick={() => setClientMessage(template)}
                    className="px-3 py-1.5 text-xs rounded-[8px] border border-white/5 bg-white/5 text-[#d1d4dc] hover:text-white hover:bg-white/8 transition-all duration-150 font-['Plus_Jakarta_Sans']"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-[16px] border border-white/5 bg-white/3 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">Fecha seleccionada</p>
                  <p className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">{summaryDateLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">Horario</p>
                  <p className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">{summaryTimeLabel}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">Duración estimada</p>
                  <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {totalDurationMinutes > 0 ? `${totalDurationMinutes} min` : "Por definir"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">Empleado asignado</p>
                  <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {assignedStaffName || "Sin asignar"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-[16px] border border-white/5 bg-white/3 backdrop-blur-sm space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                  Estado de la cita
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="no_show">No se presentó</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsHighlighted((prev) => !prev)}
                className={`w-full flex items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-all duration-150 text-left ${
                  isHighlighted
                    ? "border-[#FFC107]/40 bg-[rgba(255,193,7,0.1)]"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                }`}
              >
                <span className="text-lg">⭐</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                    {isHighlighted ? "Cita destacada" : "Marcar como destacado"}
                  </p>
                  <p className="text-[11px] text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                    {isHighlighted
                      ? "Esta cita aparecerá resaltada en la agenda."
                      : "Haz clic para resaltar la cita en la agenda."}
                  </p>
                </div>
                <div className={`ml-auto flex h-5 w-10 items-center rounded-full px-1 ${isHighlighted ? "bg-[#FFC107]/60" : "bg-white/10"}`}>
                  <div
                    className={`h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ${
                      isHighlighted ? "translate-x-4" : ""
                    }`}
                  />
                </div>
              </button>
            </div>

            <div className="p-4 rounded-[16px] border border-white/5 bg-gradient-to-br from-[#111218] via-[#14161b] to-[#0f1013] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9ca3af] font-['Plus_Jakarta_Sans']">Importe estimado</span>
                <span className="text-2xl font-semibold text-white font-['Plus_Jakarta_Sans']">
                  {(totals.total / 100).toFixed(2)} €
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-[#d1d4dc] font-['Plus_Jakarta_Sans']">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Subtotal</p>
                  <p className="font-semibold text-white">
                    {(totals.subtotal / 100).toFixed(2)} €
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">Descuentos</p>
                  <p className="font-semibold text-white">
                    -{(totals.totalDiscount / 100).toFixed(2)} €
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] uppercase tracking-wider text-[#9ca3af]">A pagar hoy</p>
                  <p className="text-lg font-semibold text-[#4FE3C1]">
                    {(totals.toPayToday / 100).toFixed(2)} €
                  </p>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                  Duración estimada:{" "}
                  <span className="font-semibold text-white">
                    {totalDurationMinutes > 0 ? `${totalDurationMinutes} min` : "Por definir"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
        {ToastComponent}
      </UiModal>

      {/* Ficha rápida de cliente */}
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
            // El cliente ya está seleccionado, solo necesitamos cerrar la vista
          }}
        />
      )}
    </>
  );
}

