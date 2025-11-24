"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, Bell, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationType = "success" | "error" | "warning" | "info" | "achievement";

interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
  action?: NotificationAction;
  icon?: ReactNode;
  context?: {
    category?: string;
    priority?: "low" | "medium" | "high";
    source?: string;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, "id">) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center";
  maxNotifications?: number;
}

/**
 * NotificationProvider - Sistema de notificaciones inteligente premium
 */
export function NotificationProvider({
  children,
  position = "top-right",
  maxNotifications = 5
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = (notification: Omit<Notification, "id">) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000, // Default 5 seconds
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Keep only maxNotifications
      return updated.slice(0, maxNotifications);
    });

    // Auto-dismiss if duration > 0
    if (newNotification.duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, newNotification.duration);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2"
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        dismissNotification,
        clearAll,
      }}
    >
      {children}

      {/* Notification container */}
      <div className={cn("fixed z-50 pointer-events-none", positionClasses[position])}>
        <div className="space-y-2">
          <AnimatePresence>
            {notifications.map((notification, index) => (
              <NotificationToast
                key={notification.id}
                notification={notification}
                onDismiss={() => dismissNotification(notification.id)}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </NotificationContext.Provider>
  );
}

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
  index: number;
}

/**
 * NotificationToast - Componente individual de notificación premium
 */
function NotificationToast({ notification, onDismiss, index }: NotificationToastProps) {
  const getTypeConfig = (type: NotificationType) => {
    switch (type) {
      case "success":
        return {
          icon: CheckCircle,
          bg: "bg-[var(--status-success-glass)]",
          border: "border-[var(--status-success-border)]",
          text: "text-[var(--status-success)]",
          iconColor: "text-[var(--status-success)]",
        };
      case "error":
        return {
          icon: AlertCircle,
          bg: "bg-[var(--status-error-glass)]",
          border: "border-[var(--status-error-border)]",
          text: "text-[var(--status-error)]",
          iconColor: "text-[var(--status-error)]",
        };
      case "warning":
        return {
          icon: AlertCircle,
          bg: "bg-[var(--status-warning-glass)]",
          border: "border-[var(--status-warning-border)]",
          text: "text-[var(--status-warning)]",
          iconColor: "text-[var(--status-warning)]",
        };
      case "achievement":
        return {
          icon: Zap,
          bg: "bg-gradient-to-r from-[var(--accent-purple-glass)] to-[var(--accent-pink-glass)]",
          border: "border-[var(--accent-purple-border)]",
          text: "text-[var(--accent-purple)]",
          iconColor: "text-[var(--accent-purple)]",
        };
      default: // info
        return {
          icon: Info,
          bg: "bg-[var(--accent-blue-glass)]",
          border: "border-[var(--accent-blue-border)]",
          text: "text-[var(--accent-blue)]",
          iconColor: "text-[var(--accent-blue)]",
        };
    }
  };

  const config = getTypeConfig(notification.type);
  const Icon = notification.icon ? () => <>{notification.icon}</> : config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: index * 0.1
      }}
      className={cn(
        "pointer-events-auto w-80 max-w-sm rounded-[var(--radius-lg)] border backdrop-blur-md shadow-lg",
        config.bg,
        config.border
      )}
      style={{
        background: notification.type === "achievement"
          ? "linear-gradient(135deg, rgba(160,107,255,0.1) 0%, rgba(255,109,163,0.1) 100%)"
          : undefined,
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            notification.type === "achievement" ? "bg-[var(--accent-purple)]/20" : "bg-current/10"
          )}>
            <Icon className={cn("h-4 w-4", config.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "text-sm font-semibold font-[var(--font-heading)]",
              config.text
            )}>
              {notification.title}
            </h4>

            {notification.message && (
              <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                {notification.message}
              </p>
            )}

            {/* Context info */}
            {notification.context && (
              <div className="flex items-center gap-2 mt-2">
                {notification.context.category && (
                  <span className="text-xs bg-[var(--glass-bg)] px-2 py-0.5 rounded-full text-[var(--text-tertiary)]">
                    {notification.context.category}
                  </span>
                )}
                {notification.context.priority && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    notification.context.priority === "high"
                      ? "bg-[var(--status-error)]/10 text-[var(--status-error)]"
                      : notification.context.priority === "medium"
                      ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                      : "bg-[var(--text-tertiary)]/10 text-[var(--text-tertiary)]"
                  )}>
                    {notification.context.priority}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-colors"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action button */}
        {notification.action && (
          <div className="mt-3 pt-3 border-t border-[var(--glass-border-subtle)]">
            <Button
              size="sm"
              variant={notification.action.variant === "destructive" ? "destructive" : "default"}
              onClick={notification.action.onClick}
              className="w-full"
            >
              {notification.action.label}
            </Button>
          </div>
        )}

        {/* Achievement special effects */}
        {notification.type === "achievement" && (
          <div className="absolute inset-0 rounded-[var(--radius-lg)] overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Convenience hooks for common notifications
 */
export function useNotificationActions() {
  const { showNotification } = useNotifications();

  const success = (title: string, message?: string, action?: NotificationAction) => {
    showNotification({
      type: "success",
      title,
      message,
      action,
      context: { category: "success" }
    });
  };

  const error = (title: string, message?: string, action?: NotificationAction) => {
    showNotification({
      type: "error",
      title,
      message,
      action,
      duration: 0, // Persistent
      context: { category: "error", priority: "high" }
    });
  };

  const warning = (title: string, message?: string, action?: NotificationAction) => {
    showNotification({
      type: "warning",
      title,
      message,
      action,
      context: { category: "warning", priority: "medium" }
    });
  };

  const info = (title: string, message?: string, action?: NotificationAction) => {
    showNotification({
      type: "info",
      title,
      message,
      action,
      context: { category: "info" }
    });
  };

  const achievement = (title: string, message?: string, action?: NotificationAction) => {
    showNotification({
      type: "achievement",
      title,
      message,
      action,
      duration: 8000, // Longer duration for achievements
      context: { category: "achievement", priority: "high" }
    });
  };

  return { success, error, warning, info, achievement };
}
