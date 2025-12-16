"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassInput } from "@/components/ui/glass/GlassInput";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/agenda/primitives/GlassCard";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  resultCount?: number;
  totalCount?: number;
}

export function SearchPanel({
  isOpen,
  onClose,
  searchTerm,
  onSearchChange,
  resultCount,
  totalCount,
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus logic needs to handle the GlassInput ref structure or just rely on autoFocus prop if available
    // For now we'll skip direct ref focus on GlassInput unless it forwards ref correctly
    const timer = setTimeout(() => {
      const input = document.querySelector('input[placeholder="Buscar por cliente, teléfono o servicio..."]') as HTMLInputElement;
      if (isOpen && input) {
        input.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="absolute top-full left-0 right-0 mt-2 z-50"
      >
        <GlassCard variant="popover" padding="md" className="border border-white/10 shadow-[0px_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <GlassInput
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar por cliente, teléfono o servicio..."
                leftIcon={<Search className="h-4 w-4" />}
                className="w-full"
                autoFocus
              />
              {searchTerm && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                  <GlassButton
                    onClick={() => onSearchChange("")}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </GlassButton>
                </div>
              )}
            </div>
            <GlassButton
              onClick={onClose}
              variant="secondary"
              size="sm"
            >
              Cerrar
            </GlassButton>
          </div>
          {searchTerm && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-[var(--text-secondary)] font-['Plus_Jakarta_Sans']">
                Buscando: <span className="text-white font-semibold">{searchTerm}</span>
              </div>
              {resultCount !== undefined && totalCount !== undefined && (
                <div className="text-xs font-['Plus_Jakarta_Sans']">
                  {resultCount === 0 ? (
                    <span className="text-[var(--status-error)] font-semibold">No hay coincidencias</span>
                  ) : (
                    <span className="text-[var(--status-success)] font-semibold">
                      {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
                      {totalCount !== resultCount && ` de ${totalCount}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
}

