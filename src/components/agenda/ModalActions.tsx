"use client";

import { ReactNode } from "react";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { cn } from "@/lib/utils";

export interface ModalAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

export interface ModalActionsConfig {
  actions: ModalAction[];
  layout?: "start" | "center" | "end" | "space-between";
  size?: "sm" | "md" | "lg";
  showCancel?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}

/**
 * ModalActions - API estándar para acciones en footer de modales
 * Proporciona una interfaz consistente para todos los modales de agenda
 */
export function ModalActions({
  actions,
  layout = "end",
  size = "md",
  showCancel = true,
  onCancel,
  cancelLabel = "Cancelar",
}: ModalActionsConfig) {
  const layoutClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    "space-between": "justify-between",
  };

  const sizeClasses = {
    sm: "gap-2 p-4",
    md: "gap-3 p-6",
    lg: "gap-4 p-8",
  };

  return (
    <div className={cn(
      "flex items-center border-t border-[var(--glass-border-subtle)]",
      layoutClasses[layout],
      sizeClasses[size]
    )}>
      {/* Cancel button */}
      {showCancel && onCancel && (
        <GlassButton
          variant="ghost"
          onClick={onCancel}
          size={size === "sm" ? "sm" : "md"}
        >
          {cancelLabel}
        </GlassButton>
      )}

      {/* Custom actions */}
      <div className="flex gap-2">
        {actions.map((action) => (
          <GlassButton
            key={action.id}
            variant={action.variant || "secondary"}
            onClick={action.onClick}
            disabled={action.disabled}
            isLoading={action.loading}
            size={size === "sm" ? "sm" : "md"}
            className={cn(
              action.variant === "primary" && "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-aqua)] text-white border-0",
              action.variant === "danger" && "bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent-orange)] text-white border-0"
            )}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </GlassButton>
        ))}
      </div>
    </div>
  );
}

/**
 * Hook helper para crear acciones comunes
 */
export function useModalActions() {
  const createSaveAction = (
    onSave: () => void,
    options?: {
      label?: string;
      disabled?: boolean;
      loading?: boolean;
      variant?: "primary" | "secondary";
    }
  ): ModalAction => ({
    id: "save",
    label: options?.label || "Guardar",
    variant: options?.variant || "primary",
    disabled: options?.disabled,
    loading: options?.loading,
    onClick: onSave,
  });

  const createDeleteAction = (
    onDelete: () => void,
    options?: {
      label?: string;
      disabled?: boolean;
      loading?: boolean;
    }
  ): ModalAction => ({
    id: "delete",
    label: options?.label || "Eliminar",
    variant: "danger",
    disabled: options?.disabled,
    loading: options?.loading,
    onClick: onDelete,
  });

  const createCancelAction = (
    onCancel: () => void,
    options?: {
      label?: string;
      disabled?: boolean;
    }
  ): ModalAction => ({
    id: "cancel",
    label: options?.label || "Cancelar",
    variant: "ghost",
    disabled: options?.disabled,
    onClick: onCancel,
  });

  const createConfirmAction = (
    onConfirm: () => void,
    options?: {
      label?: string;
      disabled?: boolean;
      loading?: boolean;
      variant?: "primary" | "secondary" | "danger";
    }
  ): ModalAction => ({
    id: "confirm",
    label: options?.label || "Confirmar",
    variant: options?.variant || "primary",
    disabled: options?.disabled,
    loading: options?.loading,
    onClick: onConfirm,
  });

  return {
    createSaveAction,
    createDeleteAction,
    createCancelAction,
    createConfirmAction,
  };
}
