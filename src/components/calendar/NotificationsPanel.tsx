"use client";

import { useEffect, useRef } from "react";
import { X, CheckCircle2, XCircle, AlertCircle, Info, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SheetModalFrame } from "@/components/ui/sheet-modal-frame";

export interface AgendaNotificationItem {
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
  notifications?: AgendaNotificationItem[];
  onRemove?: (id: string) => void;
  onClearAll?: () => void;
}

const notificationIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const notificationColors = {
  success: "text-[var(--bf-success)]",
  error: "text-[var(--bf-danger)]",
  warning: "text-[var(--bf-warn)]",
  info: "text-[var(--bf-primary)]",
};

export function NotificationsPanel({
  isOpen,
  onClose,
  notifications = [],
  onRemove,
  onClearAll,
}: NotificationsPanelProps) {
  const titleId = useRef(`notifications-panel-${Math.random().toString(36).slice(2, 9)}`);
  const hasItems = notifications.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <SheetModalFrame
      isOpen={isOpen}
      onClose={onClose}
      onBackdropClick={onClose}
      size="md"
      titleId={titleId.current}
      sheetClassName="md:max-w-[min(100%,24rem)]"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "shrink-0 border-b border-[var(--bf-border)] px-4 pb-3 pt-1",
            "md:pt-[max(0.25rem,env(safe-area-inset-top,0px))]"
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id={titleId.current}
              className="text-base font-semibold text-[var(--bf-ink-50)]"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Notificaciones
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {hasItems && onClearAll && (
                <button
                  type="button"
                  onClick={() => onClearAll()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-2 text-xs font-medium",
                    "text-[var(--bf-ink-300)] ring-1 ring-[var(--bf-border)]",
                    "transition-colors hover:bg-[var(--bf-bg-elev)] hover:text-[var(--bf-ink-50)]"
                  )}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Vaciar todas
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-[var(--r-md)] px-4 py-2 text-xs font-semibold",
                  "bg-[var(--bf-primary)] text-[var(--bf-ink)] shadow-[var(--bf-shadow-glow)]",
                  "transition hover:brightness-105 active:brightness-95"
                )}
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--bf-border-2)]",
            "pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          )}
        >
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p
                className="text-sm text-[var(--bf-ink-400)]"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                No hay notificaciones
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type];
                return (
                  <li
                    key={notification.id}
                    className={cn(
                      "relative rounded-[var(--r-lg)] border border-[var(--bf-border)] bg-[var(--bf-bg-elev)] p-3 pr-10 transition-colors",
                      !notification.read &&
                        "border-l-[3px] border-l-[var(--bf-primary)] pl-[calc(0.75rem-3px)]"
                    )}
                  >
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(notification.id)}
                        className={cn(
                          "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-[var(--r-md)]",
                          "text-[var(--bf-ink-400)] hover:bg-[var(--bf-surface)] hover:text-[var(--bf-ink-50)]",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-primary)]"
                        )}
                        aria-label={`Eliminar: ${notification.title}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div className="flex gap-3">
                      <Icon
                        className={cn(
                          "mt-0.5 h-5 w-5 shrink-0",
                          notificationColors[notification.type]
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 pr-1">
                          <h3
                            className="text-sm font-semibold text-[var(--bf-ink-50)]"
                            style={{ fontFamily: "var(--font-sans)" }}
                          >
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <span
                              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--bf-primary)]"
                              aria-hidden
                            />
                          )}
                        </div>
                        <p
                          className="mt-1 text-xs leading-relaxed text-[var(--bf-ink-300)]"
                          style={{ fontFamily: "var(--font-sans)" }}
                        >
                          {notification.message}
                        </p>
                        <p
                          className="mt-2 text-[11px] text-[var(--bf-ink-400)]"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {notification.timestamp}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SheetModalFrame>
  );
}
