"use client";

import { forwardRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { Input } from "./Input";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  label?: string;
  disabled?: boolean;
  showClearButton?: boolean;
}

export const SearchInput = forwardRef<HTMLDivElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onSearch,
      placeholder = "Buscar...",
      debounceMs = 300,
      className,
      label,
      disabled = false,
      showClearButton = true,
    },
    ref
  ) => {
    const [localValue, setLocalValue] = useState(value);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const debouncedSearch = useCallback(
      (searchValue: string) => {
        if (onSearch) {
          setIsSearching(true);
          onSearch(searchValue);
          setTimeout(() => setIsSearching(false), 200);
        }
      },
      [onSearch]
    );

    useEffect(() => {
      const timer = setTimeout(() => {
        onChange(localValue);
        if (onSearch) {
          debouncedSearch(localValue);
        }
      }, debounceMs);

      return () => clearTimeout(timer);
    }, [localValue, debounceMs, onChange, onSearch, debouncedSearch]);

    const handleClear = () => {
      setLocalValue("");
      onChange("");
      if (onSearch) {
        onSearch("");
      }
    };

    return (
      <div ref={ref} className={cn("relative w-full", className)}>
        <div className="relative">
          <Input
            label={label}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            icon={<Search className="h-4 w-4 text-[var(--text-secondary)]" />}
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="h-4 w-4 rounded-full border-2 border-[var(--accent-aqua)] border-t-transparent animate-spin"
              />
            )}
            {!isSearching && localValue && showClearButton && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleClear}
                className="p-1 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-subtle)] transition-all"
                style={{ transitionDuration: "var(--duration-base)" }}
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

/**
 * ============================================================================
 * SEARCHINPUT COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Búsqueda de clientes
 * - Búsqueda de servicios
 * - Cualquier input de búsqueda con debounce
 * 
 * PROPS PRINCIPALES:
 * - value: string - Valor del input
 * - onChange: (value: string) => void - Callback cuando cambia el valor
 * - onSearch: (value: string) => void - Callback con debounce para búsqueda
 * - placeholder: string - Texto placeholder
 * - debounceMs: number - Milisegundos de debounce (default: 300)
 * - showClearButton: boolean - Mostrar botón de limpiar
 * - disabled: boolean - Deshabilitar el input
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState("");
 * 
 * <SearchInput
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   onSearch={(value) => {
 *     // Búsqueda con debounce
 *     filterCustomers(value);
 *   }}
 *   placeholder="Buscar por nombre, email..."
 *   debounceMs={300}
 * />
 * ```
 */

