"use client";

import { useEffect, useMemo, useState } from "react";
import { format, addMinutes } from "date-fns";
import { AgendaModal } from "@/components/calendar/AgendaModal";
import { useToast } from "@/components/ui/Toast";
import type { Staff, CalendarSlot } from "@/types/agenda";
import type { BlockingMutationPayload, SaveBlockingResult } from "@/hooks/useAgendaHandlers";

interface StaffBlockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: BlockingMutationPayload) => Promise<SaveBlockingResult>;
  staff: Staff[];
  slot?: CalendarSlot | null;
  isLoading?: boolean;
}

const BLOCK_OPTIONS: BlockingMutationPayload["type"][] = ["block", "absence", "vacation"];

export default function StaffBlockingModal({
  isOpen,
  onClose,
  onSave,
  staff,
  slot,
  isLoading = false,
}: StaffBlockingModalProps) {
  const { showToast, ToastComponent } = useToast();
  const [staffId, setStaffId] = useState("");
  const [blockingType, setBlockingType] = useState<BlockingMutationPayload["type"]>("block");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (slot) {
      setStaffId(slot.staffId || "");
      setDate(slot.date);
      setStartTime(slot.time);
      if (slot.endTime) {
        setEndTime(slot.endTime);
      } else {
        const fallback = addMinutes(new Date(`${slot.date}T${slot.time}`), 60);
        setEndTime(format(fallback, "HH:mm"));
      }
      if (slot.type) setBlockingType(slot.type);
    } else {
      setStaffId("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("10:00");
      setBlockingType("block");
    }
    setReason("");
    setNotes("");
  }, [isOpen, slot]);

  const selectedStaff = useMemo(() => staff.find((member) => member.id === staffId), [staff, staffId]);

  const handleSave = async () => {
    if (!staffId.trim()) {
      showToast("Selecciona un empleado", "error");
      return;
    }
    if (!reason.trim()) {
      showToast("Añade un motivo", "error");
      return;
    }

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (end <= start) {
      showToast("La hora de fin debe ser posterior", "error");
      return;
    }

    const payload: BlockingMutationPayload = {
      staff_id: staffId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      type: blockingType,
      reason: reason.trim(),
      notes: notes.trim() || null,
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
        title="Bloquear agenda"
        size="md"
        context={{ type: "staff" }}
        actions={[
          {
            id: "save-blocking",
            label: "Guardar",
            variant: "primary",
            onClick: handleSave,
            loading: isLoading,
            disabled: !staffId.trim() || !reason.trim() || isLoading,
          },
        ]}
        actionsConfig={{
          layout: "end",
          showCancel: true,
          onCancel: onClose,
          cancelLabel: "Cancelar",
        }}
      >
        <div className="space-y-5">
          <div className="p-4 rounded-[16px] border border-white/5 bg-white/5">
            <p className="text-xs uppercase text-white/60">Resumen</p>
            <p className="text-lg font-semibold text-white">
              {format(new Date(`${date}T${startTime}`), "EEEE d 'de' MMMM")}
            </p>
            <p className="text-sm text-white/70">
              {startTime} · {endTime}
            </p>
            {selectedStaff && (
              <p className="text-xs text-white/60 mt-3">{selectedStaff.name}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-2">Empleado</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
              disabled={Boolean(slot?.staffId)}
            >
              <option value="">Selecciona...</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-semibold text-white mb-2">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-white mb-2">Inicio</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-white mb-2">Fin</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-2">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {BLOCK_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBlockingType(option)}
                  className={`rounded-[12px] border px-3 py-2 text-sm transition-all ${
                    blockingType === option ? "border-[#3A6DFF] text-[#3A6DFF] bg-[#3A6DFF]/10" : "border-white/10 text-white/70"
                  }`}
                >
                  {option === "block" && "Bloqueo"}
                  {option === "absence" && "Ausencia"}
                  {option === "vacation" && "Vacaciones"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-2">Motivo</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Vacaciones"
              className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-2">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-[12px] border border-white/10 bg-[#1b1d21] px-4 py-2.5 text-sm text-white"
            />
          </div>
        </div>
        {ToastComponent}
      </AgendaModal>
    </>
  );
}

