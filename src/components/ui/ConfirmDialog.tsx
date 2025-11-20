"use client";

import { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p
        className="text-sm text-[var(--text-secondary)]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {message}
      </p>
    </Modal>
  );
}

/**
 * ============================================================================
 * CONFIRMDIALOG COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Confirmación de eliminación
 * - Confirmación de acciones críticas
 * - Cualquier diálogo de confirmación reutilizable
 * 
 * PROPS PRINCIPALES:
 * - isOpen: boolean - Estado de apertura
 * - onClose: () => void - Callback para cerrar
 * - onConfirm: () => void - Callback para confirmar
 * - title: string - Título del diálogo
 * - message: string - Mensaje de confirmación
 * - confirmLabel: string - Texto del botón confirmar
 * - cancelLabel: string - Texto del botón cancelar
 * - variant: "default" | "danger" - Variante del botón confirmar
 * - isLoading: boolean - Estado de carga
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * const [showConfirm, setShowConfirm] = useState(false);
 * 
 * <ConfirmDialog
 *   isOpen={showConfirm}
 *   onClose={() => setShowConfirm(false)}
 *   onConfirm={async () => {
 *     await deleteService(serviceId);
 *     setShowConfirm(false);
 *   }}
 *   title="Eliminar servicio"
 *   message="¿Estás seguro de que quieres eliminar este servicio? Esta acción no se puede deshacer."
 *   confirmLabel="Eliminar"
 *   cancelLabel="Cancelar"
 *   variant="danger"
 *   isLoading={deleting}
 * />
 * ```
 */


