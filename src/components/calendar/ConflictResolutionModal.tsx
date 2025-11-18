"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Clock, User, X } from "lucide-react";
import { formatInTenantTz } from "@/lib/timezone";
import { motion } from "framer-motion";

interface Conflict {
  type: "booking" | "blocking";
  id: string;
  staff_id: string;
  staff_name?: string;
  start_at: string;
  end_at: string;
  customer_name?: string;
  service_name?: string;
  blocking_type?: "block" | "absence" | "vacation";
  blocking_reason?: string;
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: Conflict[];
  newBookingStart: string;
  newBookingEnd: string;
  newBookingStaffId: string;
  newBookingStaffName?: string;
  timezone: string;
  onResolve: (action: "change_time" | "change_staff" | "force" | "cancel") => void;
  onClose: () => void;
  userRole?: "owner" | "admin" | "manager" | "staff";
}

export function ConflictResolutionModal({
  isOpen,
  conflicts,
  newBookingStart,
  newBookingEnd,
  newBookingStaffId,
  newBookingStaffName,
  timezone,
  onResolve,
  onClose,
  userRole = "staff",
}: ConflictResolutionModalProps) {
  // Convertir fechas a timezone local para mostrar
  const formatLocalTime = (dateStr: string) => {
    if (!dateStr || dateStr.trim() === "") {
      return "--:--";
    }
    
    try {
      return formatInTenantTz(dateStr, timezone, "HH:mm");
    } catch (error) {
      console.warn("Error formateando fecha:", dateStr, error);
      return "--:--";
    }
  };

  const canForce = userRole === "owner" || userRole === "admin" || userRole === "manager";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conflicto de horario detectado"
      size="md"
    >
      <div className="space-y-4">
        {/* Alerta */}
        <div className="flex items-start gap-3 p-4 bg-[rgba(255,193,7,0.12)] border border-[#FFC107]/30 rounded-[14px] backdrop-blur-sm">
          <AlertTriangle className="h-5 w-5 text-[#FFC107] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#FFC107] mb-1 font-['Plus_Jakarta_Sans']">
              El horario seleccionado tiene conflictos
            </p>
            <p className="text-xs text-[#FFC107]/80 font-['Plus_Jakarta_Sans']">
              {newBookingStaffName && (
                <span>
                  <strong>{newBookingStaffName}</strong> ya tiene{" "}
                  {conflicts.length === 1 ? "una cita/bloqueo" : `${conflicts.length} citas/bloqueos`}{" "}
                  programados en este horario.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Nuevo horario propuesto */}
        {(newBookingStart || newBookingEnd) && (
          <div className="p-3 bg-[rgba(58,109,255,0.08)] border border-[#3A6DFF]/30 rounded-[14px] backdrop-blur-sm">
            <p className="text-[10px] font-semibold text-[#9ca3af] mb-2 font-['Plus_Jakarta_Sans'] uppercase tracking-wider">Nueva cita propuesta:</p>
            <div className="flex items-center gap-2 text-sm text-white font-['Plus_Jakarta_Sans']">
              <Clock className="h-4 w-4 text-[#3A6DFF]" />
              <span>
                {formatLocalTime(newBookingStart)} - {formatLocalTime(newBookingEnd)}
              </span>
              {newBookingStaffName && (
                <>
                  <span className="text-[#3A6DFF]">•</span>
                  <User className="h-4 w-4 text-[#3A6DFF]" />
                  <span>{newBookingStaffName}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Lista de conflictos */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">Conflictos encontrados:</p>
          {conflicts.map((conflict, index) => (
            <div
              key={conflict.id || index}
              className="p-3 bg-[rgba(239,68,68,0.08)] border border-[#EF4444]/30 rounded-[14px] backdrop-blur-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-[#EF4444]" />
                    <span className="text-sm font-semibold text-[#EF4444] font-['Plus_Jakarta_Sans']">
                      {formatLocalTime(conflict.start_at)} - {formatLocalTime(conflict.end_at)}
                    </span>
                  </div>
                  {conflict.type === "booking" ? (
                    <>
                      {conflict.customer_name && (
                        <p className="text-xs text-[#EF4444]/80 font-['Plus_Jakarta_Sans']">
                          Cliente: <strong>{conflict.customer_name}</strong>
                        </p>
                      )}
                      {conflict.service_name && (
                        <p className="text-xs text-[#EF4444]/80 font-['Plus_Jakarta_Sans']">
                          Servicio: {conflict.service_name}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[#EF4444] font-['Plus_Jakarta_Sans']">
                        <strong>
                          {conflict.blocking_type === "block"
                            ? "Bloqueo"
                            : conflict.blocking_type === "absence"
                            ? "Ausencia"
                            : "Vacaciones"}
                        </strong>
                      </p>
                      {conflict.blocking_reason && (
                        <p className="text-xs text-[#EF4444]/70 font-['Plus_Jakarta_Sans']">
                          {conflict.blocking_reason}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Opciones de resolución */}
        <div className="pt-4 border-t border-white/5 space-y-2">
          <p className="text-sm font-semibold text-white mb-3 font-['Plus_Jakarta_Sans']">¿Cómo quieres resolverlo?</p>
          
          <div className="grid grid-cols-1 gap-2">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onResolve("change_time")}
              className="w-full px-4 py-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[12px] transition-all duration-150 flex items-center justify-start gap-3 font-['Plus_Jakarta_Sans'] group"
            >
              <div className="p-1.5 rounded-[8px] bg-[rgba(58,109,255,0.12)] group-hover:bg-[rgba(58,109,255,0.18)] transition-colors">
                <Clock className="h-4 w-4 text-[#3A6DFF]" />
              </div>
              <span>Cambiar la hora de la nueva cita</span>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onResolve("change_staff")}
              className="w-full px-4 py-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/8 border border-white/10 rounded-[12px] transition-all duration-150 flex items-center justify-start gap-3 font-['Plus_Jakarta_Sans'] group"
            >
              <div className="p-1.5 rounded-[8px] bg-[rgba(79,227,193,0.12)] group-hover:bg-[rgba(79,227,193,0.18)] transition-colors">
                <User className="h-4 w-4 text-[#4FE3C1]" />
              </div>
              <span>Asignar a otro empleado</span>
            </motion.button>

            {canForce && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onResolve("force")}
                className="w-full px-4 py-3 text-sm font-semibold text-[#FFC107] bg-[rgba(255,193,7,0.08)] hover:bg-[rgba(255,193,7,0.12)] border border-[#FFC107]/30 rounded-[12px] transition-all duration-150 flex items-center justify-start gap-3 font-['Plus_Jakarta_Sans'] group"
              >
                <div className="p-1.5 rounded-[8px] bg-[rgba(255,193,7,0.12)] group-hover:bg-[rgba(255,193,7,0.18)] transition-colors">
                  <X className="h-4 w-4 text-[#FFC107]" />
                </div>
                <span>Forzar solape (solo administradores)</span>
              </motion.button>
            )}
            
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onResolve("cancel")}
              className="w-full px-4 py-3 text-sm font-medium text-[#d1d4dc] hover:text-white hover:bg-white/5 border border-white/5 rounded-[12px] transition-all duration-150 flex items-center justify-center gap-2 font-['Plus_Jakarta_Sans'] mt-2"
            >
              Cancelar
            </motion.button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

