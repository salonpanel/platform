"use client";

import { X, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/ui/glass/GlassButton";

interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: Notification[];
}

const notificationIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const notificationColors = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
};

// Mock data para desarrollo
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "success",
    title: "Nueva reserva online",
    message: "Juan Pérez ha realizado una reserva para mañana a las 10:00",
    timestamp: "Hace 5 minutos",
    read: false,
  },
  {
    id: "2",
    type: "warning",
    title: "Cita cancelada",
    message: "María García ha cancelado su cita del 15 de noviembre",
    timestamp: "Hace 1 hora",
    read: false,
  },
  {
    id: "3",
    type: "error",
    title: "Error al procesar pago",
    message: "No se pudo procesar el pago de la cita #1234",
    timestamp: "Hace 2 horas",
    read: true,
  },
];

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications = mockNotifications,
}: NotificationsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer - funciona en móvil y desktop */}
      <div className="absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-[#15171A] border-l border-white/5 flex flex-col shadow-[0px_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white font-['Plus_Jakarta_Sans']">
            Notificaciones
          </h3>
          <GlassButton
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-[#d1d4dc] hover:text-white"
          >
            <X className="h-5 w-5" />
          </GlassButton>
        </div>

        {/* Lista de notificaciones */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                No hay notificaciones
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = notificationIcons[notification.type];
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 cursor-pointer bg-white/3 border border-white/5 rounded-[14px] hover:bg-white/5 transition-colors",
                    !notification.read && "border-l-4 border-[#3A6DFF]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0 mt-0.5",
                        notificationColors[notification.type]
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-white font-['Plus_Jakarta_Sans']">
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-[#3A6DFF] flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-[#d1d4dc] mt-1 font-['Plus_Jakarta_Sans']">
                        {notification.message}
                      </p>
                      <p className="text-xs text-[#9ca3af] mt-2 font-['Plus_Jakarta_Sans']">
                        {notification.timestamp}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
