"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";

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
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
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
        <div className="bg-[#15171A] rounded-2xl border border-white/10 shadow-[0px_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar por cliente, teléfono o servicio..."
                className="w-full pl-10 pr-10 py-2.5 rounded-[10px] border border-white/5 bg-white/5 text-white placeholder:text-[#9ca3af] focus:border-[#3A6DFF] focus:outline-none focus:ring-2 focus:ring-[#3A6DFF]/30 transition-all duration-150 font-['Plus_Jakarta_Sans']"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-white hover:bg-white/5 rounded-[8px] transition-all duration-150"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-[#d1d4dc] hover:text-white hover:bg-white/5 border border-white/5 rounded-[10px] transition-all duration-150 font-['Plus_Jakarta_Sans']"
            >
              Cerrar
            </button>
          </div>
          {searchTerm && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-[#9ca3af] font-['Plus_Jakarta_Sans']">
                Buscando: <span className="text-white font-semibold">{searchTerm}</span>
              </div>
              {resultCount !== undefined && totalCount !== undefined && (
                <div className="text-xs font-['Plus_Jakarta_Sans']">
                  {resultCount === 0 ? (
                    <span className="text-[#FF6DA3] font-semibold">No hay coincidencias</span>
                  ) : (
                    <span className="text-[#4FE3C1] font-semibold">
                      {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
                      {totalCount !== resultCount && ` de ${totalCount}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

