"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  error,
  helperText,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          className="mb-2 block text-sm font-semibold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {label}
          {required && (
            <span className="text-[var(--color-danger)] ml-1">*</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          className="mt-2 text-xs text-[var(--color-danger)] font-semibold"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {error}
        </motion.p>
      )}
      {helperText && !error && (
        <p
          className="mt-2 text-xs text-[var(--text-secondary)] font-medium"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * FORMFIELD COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Wrapper para cualquier campo de formulario
 * - Unifica label, error y helper text
 * - Consistencia visual en formularios
 * 
 * PROPS PRINCIPALES:
 * - label: string - Etiqueta del campo
 * - error: string - Mensaje de error
 * - helperText: string - Texto de ayuda
 * - required: boolean - Mostrar asterisco de requerido
 * - children: ReactNode - El input/select/etc. a envolver
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * <FormField
 *   label="Nombre del servicio"
 *   error={errors.name}
 *   helperText="El nombre será visible para los clientes"
 *   required
 * >
 *   <Input
 *     value={form.name}
 *     onChange={(e) => setForm({ ...form, name: e.target.value })}
 *   />
 * </FormField>
 * 
 * <FormField
 *   label="Categoría"
 *   error={errors.category}
 * >
 *   <Select
 *     value={form.category}
 *     onChange={(e) => setForm({ ...form, category: e.target.value })}
 *   >
 *     <option value="">Seleccionar...</option>
 *     <option value="Corte">Corte</option>
 *   </Select>
 * </FormField>
 * ```
 */

