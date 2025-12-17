"use client";

import { ReactNode, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { LoadingSkeleton } from "./LoadingSkeleton";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  pageSize?: number;
  showPagination?: boolean;
  emptyMessage?: string;
  mobileCard?: (row: T) => ReactNode;
}

type SortDirection = "asc" | "desc" | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  onRowClick,
  className,
  pageSize = 10,
  showPagination = true,
  emptyMessage = "No hay datos disponibles",
  mobileCard,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, showPagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="h-3 w-3" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <LoadingSkeleton variant="rectangular" height={40} count={10} />
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto scrollbar-hide">
        <div className="glass rounded-[var(--radius-lg)] border-[var(--glass-border)] overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-[var(--glass-border-subtle)] glass-subtle">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider",
                      column.sortable && "cursor-pointer hover:text-[var(--text-primary)] transition-colors",
                      column.className
                    )}
                    style={{
                      fontFamily: "var(--font-heading)",
                      transitionDuration: "var(--duration-base)",
                    }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.header}</span>
                      {column.sortable && (
                        <span className="text-[var(--text-tertiary)]">
                          {getSortIcon(column.key)}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border-subtle)]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02, duration: 0.15 }}
                    className={cn(
                      "border-b border-[var(--glass-border-subtle)] transition-colors",
                      onRowClick && "cursor-pointer hover:bg-[var(--glass-bg-subtle)]"
                    )}
                    onClick={() => onRowClick?.(row)}
                    style={{ transitionDuration: "var(--duration-base)" }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn("px-4 py-3 text-sm text-[var(--text-primary)]", column.className)}
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {column.accessor ? column.accessor(row) : row[column.key]}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {paginatedData.length === 0 ? (
          <div
            className="p-8 text-center text-sm text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {emptyMessage}
          </div>
        ) : (
          paginatedData.map((row, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.15 }}
            >
              {mobileCard ? (
                mobileCard(row)
              ) : (
                <div
                  className="glass rounded-[var(--radius-lg)] border-[var(--glass-border)] p-4"
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <div key={column.key} className="mb-2 last:mb-0">
                      <div
                        className="text-xs text-[var(--text-tertiary)] mb-1"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {column.header}
                      </div>
                      <div
                        className="text-sm text-[var(--text-primary)]"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {column.accessor ? column.accessor(row) : row[column.key]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div
            className="text-sm text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedData.length)} de {sortedData.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              className="text-sm text-[var(--text-primary)] px-3"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * DATATABLE COMPONENT
 * ============================================================================
 * 
 * USO RECOMENDADO:
 * - Tabla de clientes con sorting y paginación
 * - Tabla de servicios con filtros
 * - Cualquier lista de datos que necesite funcionalidades avanzadas
 * 
 * PROPS PRINCIPALES:
 * - data: T[] - Array de datos
 * - columns: DataTableColumn<T>[] - Definición de columnas
 * - loading: boolean - Estado de carga
 * - onRowClick: (row: T) => void - Callback al hacer click en fila
 * - pageSize: number - Tamaño de página (default: 10)
 * - showPagination: boolean - Mostrar paginación
 * - emptyMessage: string - Mensaje cuando no hay datos
 * - mobileCard: (row: T) => ReactNode - Renderizado custom para mobile
 * 
 * EJEMPLO DE USO:
 * ```tsx
 * const columns: DataTableColumn<Customer>[] = [
 *   {
 *     key: "name",
 *     header: "Nombre",
 *     sortable: true,
 *   },
 *   {
 *     key: "email",
 *     header: "Email",
 *     sortable: true,
 *   },
 *   {
 *     key: "bookings_count",
 *     header: "Reservas",
 *     accessor: (row) => row.bookings_count || 0,
 *     sortable: true,
 *   },
 * ];
 * 
 * <DataTable
 *   data={customers}
 *   columns={columns}
 *   loading={loading}
 *   onRowClick={(customer) => openEditModal(customer)}
 *   pageSize={20}
 *   mobileCard={(customer) => (
 *     <Card>
 *       <div>{customer.name}</div>
 *       <div>{customer.email}</div>
 *     </Card>
 *   )}
 * />
 * ```
 */




