"use client";

import { useState, useEffect } from "react";
import { format, addMinutes, parseISO } from "date-fns";
import { AgendaModal } from "@/components/calendar/AgendaModal";
import { ModalActions, useModalActions, type ModalAction } from "@/components/agenda/ModalActions";
import { Input } from "@/components/ui/Input";
import { Staff, CalendarSlot } from "@/types/agenda";
import { useToast } from "@/components/ui/Toast";

interface StaffBlockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blocking: {
    staff_id: string;
    start_at: string;
    end_at: string;
    type: "block" | "absence" | "vacation";
    reason: string;
    notes?: string;
  }) => Promise<void>;
  staff: Staff[];
  slot?: CalendarSlot | null;
  isLoading?: boolean;
}

const BLOCKING_TYPES: Array<{
  value: "block" | "absence" | "vacation";
  title: string;
  description: string;
  activeClasses: string;
}> = [
  {
    value: "block",
    title: "Bloqueo rápido",
    description: "Huecos puntuales durante el día",
    activeClasses: "border-[#3A6DFF]/40 bg-[rgba(58,109,255,0.12)] text-[#3A6DFF]",
  },
  {
    value: "absence",
    title: "Ausencia",
    description: "Días completos o enfermedad",
    activeClasses: "border-[#FF6DA3]/40 bg-[rgba(255,109,163,0.12)] text-[#FF6DA3]",
  },
  {
    value: "vacation",
    title: "Vacaciones",
    description: "Periodos largos planificados",
    activeClasses: "border-[#4FE3C1]/40 bg-[rgba(79,227,193,0.12)] text-[#4FE3C1]",
  },
];

/**
 * Modal para crear/editar bloqueos y ausencias de staff
 * Más simple que el modal de nueva cita
 */
export function StaffBlockingModal({
  isOpen,
  onClose,
  onSave,
  staff,
  slot,
  isLoading = false,
}: StaffBlockingModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState(slot?.staffId || "");
  const [type, setType] = useState<"block" | "absence" | "vacation">("block");
  const [date, setDate] = useState(slot?.date || format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(slot?.time || "09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const { showToast, ToastComponent } = useToast();
  const modalActions = useModalActions();
  const selectedStaffMember = staff.find((member) => member.id === selectedStaffId);
  const summaryTimeLabel = `${startTime} - ${endTime}`;

  // Actualizar cuando cambia el slot
  useEffect(() => {
    if (slot) {
      setSelectedStaffId(slot.staffId);
      setDate(slot.date);
      if (slot.type) {
        setType(slot.type);
      }
      setStartTime(slot.time);
      
      // Validar que slot.date y slot.time sean válidos
      if (!slot.date || !slot.time) {
        setEndTime("10:00");
        return;
      }

      try {
        // Por defecto, 1 hora de duración
        const [hour, minute] = slot.time.split(":").map(Number);
        
        // Validar que hour y minute sean válidos
        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          console.warn("Hora inválida en slot:", slot.time);
          setEndTime("10:00");
          return;
        }

        const startDate = new Date(`${slot.date}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`);
        
        // Validar que la fecha sea válida
        if (isNaN(startDate.getTime())) {
          console.warn("Fecha inválida en slot:", slot.date, slot.time);
          setEndTime("10:00");
          return;
        }

        if (slot.endTime) {
          setEndTime(slot.endTime);
          return;
        }

        const endDate = addMinutes(startDate, 60);
        if (isNaN(endDate.getTime())) {
          console.warn("Fecha de fin inválida después de sumar minutos");
          setEndTime("10:00");
          return;
        }

        setEndTime(format(endDate, "HH:mm"));
      } catch (error) {
        console.error("Error al calcular hora de fin:", error);
        setEndTime("10:00");
      }
    }
  }, [slot]);

  const handleSave = async () => {
    if (!selectedStaffId || !date || !startTime || !endTime || !reason.trim()) {
      showToast("Completa todos los campos obligatorios.", "error");
      return;
    }

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startAt = new Date(`${date}T${startHour}:${startMinute}:00`).toISOString();
    const endAt = new Date(`${date}T${endHour}:${endMinute}:00`).toISOString();

    if (endAt <= startAt) {
      showToast("La hora de fin debe ser posterior a la hora de inicio.", "error");
      return;
    }

    try {
      await onSave({
        staff_id: selectedStaffId,
        start_at: startAt,
        end_at: endAt,
        type,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
    } catch (error: any) {
      showToast(error.message || "Error al guardar el bloqueo", "error");
    }
  };

  // Crear acciones para el footer
  const footerActions: ModalAction[] = [
    modalActions.createSaveAction(handleSave, {
      label: "Guardar bloqueo",
      disabled: isLoading || !selectedStaffId || !reason.trim(),
      loading: isLoading,
    }),
  ];

  const reasonSuggestions = {
    block: ["Descanso", "Reunión", "Pausa", "Otro"],
    absence: ["Enfermedad", "Permiso", "Personal", "Otro"],
    vacation: ["Vacaciones", "Día libre", "Fiesta", "Otro"],
  };

  return (
    <>
      <AgendaModal
        isOpen={isOpen}
        onClose={onClose}
        title="Añadir bloqueo o ausencia"
        size="md"
        context={{ type: "staff" }}
        actions={footerActions}
        actionsConfig={{
          layout: "end",
          showCancel: true,
          onCancel: onClose,
          cancelLabel: "Cancelar",
        }}
      >
        <div className="space-y-5">
        <div className="p-4 rounded-[16px] border border-white/5 bg-white/3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">
                Empleado
              </p>
              <p className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
                {selectedStaffMember?.name || "Sin asignar"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-semibold font-['Plus_Jakarta_Sans']">
                Horario
              </p>
              <p className="text-base font-semibold text-white font-['Plus_Jakarta_Sans']">
                {summaryTimeLabel}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
            Ajusta la fecha y la duración si necesitas ampliar o reducir el bloqueo.
          </p>
        </div>
        {/* Empleado */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
            Empleado <span className="text-[#EF4444]">*</span>
          </label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
            disabled={!!slot?.staffId}
          >
            <option value="">Seleccionar empleado...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {slot?.staffId && (
            <p className="mt-1 text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
              Este bloqueo solo aplica a {selectedStaffMember?.name || "este empleado"}.
            </p>
          )}
        </div>

        {/* Tipo */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
            Tipo <span className="text-[#EF4444]">*</span>
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {BLOCKING_TYPES.map((option) => {
              const isActive = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={`w-full rounded-[12px] border px-3 py-2 text-left transition-all duration-150 ${
                    isActive
                      ? option.activeClasses
                      : "border-white/10 bg-white/5 text-[#d1d4dc] hover:bg-white/8"
                  }`}
                >
                  <p className="text-sm font-semibold font-['Plus_Jakarta_Sans']">{option.title}</p>
                  <p className="text-[11px] text-[#9ca3af] font-['Plus_Jakarta_Sans']">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
              Fecha <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
              Hora inicio <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
              Hora fin <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
            />
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
            Motivo <span className="text-[#EF4444]">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Descanso, Vacaciones, Enfermedad..."
            className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {reasonSuggestions[type].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setReason(suggestion)}
                className="px-3 py-1.5 text-xs rounded-[8px] border border-white/5 bg-white/5 text-white hover:bg-[rgba(58,109,255,0.12)] hover:border-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas adicionales sobre el bloqueo..."
              className="w-full rounded-[10px] border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 resize-none font-['Plus_Jakarta_Sans']"
            />
          </div>
        </div>
      </AgendaModal>
      {ToastComponent}
    </>
  );
}

