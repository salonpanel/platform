'use client';

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Filter,
  Search,
  X,
  ChevronDown,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface AmountRange {
  min: number | undefined;
  max: number | undefined;
}

export interface WalletFilters {
  search: string;
  dateRange: DateRange;
  amountRange: AmountRange;
  status: string[];
  type: string[];
  sortBy: 'date' | 'amount' | 'type';
  sortOrder: 'asc' | 'desc';
}

interface WalletFiltersProps {
  filters: WalletFilters;
  onFiltersChange: (filters: WalletFilters) => void;
  className?: string;
  compact?: boolean;
}

const statusOptions = [
  { value: 'succeeded', label: 'Completado', icon: CheckCircle2, color: 'text-emerald-400' },
  { value: 'pending', label: 'Pendiente', icon: Clock, color: 'text-amber-400' },
  { value: 'failed', label: 'Fallido', icon: AlertCircle, color: 'text-red-400' },
];

const typeOptions = [
  { value: 'charge', label: 'Pago' },
  { value: 'refund', label: 'Reembolso' },
  { value: 'payout', label: 'Payout' },
  { value: 'fee', label: 'Comisión' },
  { value: 'adjustment', label: 'Ajuste' },
];

export function WalletFiltersComponent({
  filters,
  onFiltersChange,
  className,
  compact = false
}: WalletFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [tempFilters, setTempFilters] = useState(filters);

  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  const updateFilters = (updates: Partial<WalletFilters>) => {
    const newFilters = { ...tempFilters, ...updates };
    setTempFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: WalletFilters = {
      search: '',
      dateRange: { from: undefined, to: undefined },
      amountRange: { min: undefined, max: undefined },
      status: [],
      type: [],
      sortBy: 'date',
      sortOrder: 'desc'
    };
    setTempFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = () => {
    return (
      filters.search ||
      filters.dateRange.from ||
      filters.dateRange.to ||
      filters.amountRange.min ||
      filters.amountRange.max ||
      filters.status.length > 0 ||
      filters.type.length > 0
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-slate-800/30 border border-slate-700/50 rounded-[var(--radius-lg)] backdrop-blur-sm overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
            <Filter className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Filtros</h3>
            {hasActiveFilters() && (
              <p className="text-xs text-slate-400">
                {[
                  filters.search && "Búsqueda",
                  (filters.dateRange.from || filters.dateRange.to) && "Fecha",
                  (filters.amountRange.min || filters.amountRange.max) && "Monto",
                  filters.status.length > 0 && "Estado",
                  filters.type.length > 0 && "Tipo"
                ].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs"
            >
              Limpiar
            </Button>
          )}

          {compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              icon={<ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )} />}
            >
              {isExpanded ? "Ocultar" : "Mostrar"}
            </Button>
          )}
        </div>
      </div>

      {/* Filters Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por descripción..."
                  value={tempFilters.search}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={tempFilters.dateRange.from?.toISOString().split('T')[0] || ''}
                    onChange={(e) => updateFilters({
                      dateRange: {
                        ...tempFilters.dateRange,
                        from: e.target.value ? new Date(e.target.value) : undefined
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={tempFilters.dateRange.to?.toISOString().split('T')[0] || ''}
                    onChange={(e) => updateFilters({
                      dateRange: {
                        ...tempFilters.dateRange,
                        to: e.target.value ? new Date(e.target.value) : undefined
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Monto mínimo (€)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={tempFilters.amountRange.min || ''}
                    onChange={(e) => updateFilters({
                      amountRange: {
                        ...tempFilters.amountRange,
                        min: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Monto máximo (€)
                  </label>
                  <input
                    type="number"
                    placeholder="Sin límite"
                    value={tempFilters.amountRange.max || ''}
                    onChange={(e) => updateFilters({
                      amountRange: {
                        ...tempFilters.amountRange,
                        max: e.target.value ? Number(e.target.value) : undefined
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Status Filters */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Estado
                </label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = tempFilters.status.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          const newStatus = isSelected
                            ? tempFilters.status.filter(s => s !== option.value)
                            : [...tempFilters.status, option.value];
                          updateFilters({ status: newStatus });
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          isSelected
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                            : "bg-slate-900/50 border-slate-600 text-slate-300 hover:border-slate-500"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Type Filters */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Tipo
                </label>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map((option) => {
                    const isSelected = tempFilters.type.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          const newType = isSelected
                            ? tempFilters.type.filter(t => t !== option.value)
                            : [...tempFilters.type, option.value];
                          updateFilters({ type: newType });
                        }}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          isSelected
                            ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                            : "bg-slate-900/50 border-slate-600 text-slate-300 hover:border-slate-500"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Ordenar por
                  </label>
                  <select
                    value={tempFilters.sortBy}
                    onChange={(e) => updateFilters({ sortBy: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  >
                    <option value="date">Fecha</option>
                    <option value="amount">Monto</option>
                    <option value="type">Tipo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Orden
                  </label>
                  <select
                    value={tempFilters.sortOrder}
                    onChange={(e) => updateFilters({ sortOrder: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  >
                    <option value="desc">Descendente</option>
                    <option value="asc">Ascendente</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Hook para usar filtros
export function useWalletFilters(initialFilters?: Partial<WalletFilters>) {
  const [filters, setFilters] = useState<WalletFilters>({
    search: '',
    dateRange: { from: undefined, to: undefined },
    amountRange: { min: undefined, max: undefined },
    status: [],
    type: [],
    sortBy: 'date',
    sortOrder: 'desc',
    ...initialFilters
  });

  return {
    filters,
    setFilters,
    hasActiveFilters: () => {
      return (
        filters.search ||
        filters.dateRange.from ||
        filters.dateRange.to ||
        filters.amountRange.min ||
        filters.amountRange.max ||
        filters.status.length > 0 ||
        filters.type.length > 0
      );
    }
  };
}
