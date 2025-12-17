"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
// import { getSupabaseBrowser } from "@/lib/supabase/browser"; // No longer needed for mutations
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard, GlassButton, GlassInput, GlassSelect, GlassSection, GlassModal, GlassToast } from "@/components/ui/glass";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
import { CustomersGrid } from "@/components/customers/CustomersGrid";
// import { CustomerHistory } from "@/components/customers/CustomerHistory";
import {
  Calendar,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Users,
  Star,
  CheckSquare
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCustomersPageData } from "@/hooks/useOptimizedData";
import { invalidateCache } from "@/hooks/useStaleWhileRevalidate";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { useCustomersHandlers } from "@/hooks/useCustomersHandlers";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  segment: "normal" | "vip" | "banned" | "marketing" | "no_contact";
  visitCount: number;
  lastVisit?: string;
  totalSpent?: number;
  created_at: string;
}

export default function ClientesPage() {
  const searchParams = useSearchParams();
  // const supabase = getSupabaseBrowser(); // Use hook instead

  const impersonateOrgId = useMemo(() => searchParams?.get("impersonate") || null, [searchParams?.toString()]);

  // Hook optimizado: obtiene tenant + clientes en UNA llamada con caché
  const { data: pageData, isLoading, error } = useCustomersPageData(impersonateOrgId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  // Extraer datos del hook
  const tenantId = pageData?.tenant?.id || null;
  const tenantTimezone = pageData?.tenant?.timezone || "Europe/Madrid";
  const customers = pageData?.customers || [];

  // Estados principales (mantener para funcionalidad)
  // const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // const [errorMessage, setErrorMessage] = useState<string | null>(error ? "Error al cargar los clientes" : null);

  // Estados de loading
  const [loading, setLoading] = useState(false); // Para operaciones específicas (crear/editar)

  // Estados de toast (Manejados globalmente por useToast dentro de useCustomersHandlers, pero mantenemos local si se requiere feedback extra)
  // const [showToast, setShowToast] = useState(false);
  // const [toastMessage, setToastMessage] = useState<string | null>(null);
  // const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  // Estados de filtrado y búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [visitFilter, setVisitFilter] = useState<"all" | "with" | "without">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "active90" | "inactive90">("all");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "vip" | "banned" | "marketing" | "no_contact">("all");
  const [sortOption, setSortOption] = useState<"recent" | "value">("recent");

  // Estados de selección
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectionActive, setSelectionActive] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Estados de modales
  const [showNewModal, setShowNewModal] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Estado del nuevo cliente
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    segment: "normal" as "normal" | "vip" | "marketing" | "no_contact" | "banned",
    notes: ""
  });

  // Init Handlers
  const { saveCustomer, deleteCustomers } = useCustomersHandlers({
    tenantId,
    onAfterMutation: () => {
      // Invalidar cache después de la operación
      invalidateCache(`customers-page-${impersonateOrgId || 'default'}`);
    }
  });


  // Estadísticas de clientes
  const customerStats = useMemo(() => {
    const total = customers.length;
    const withBookings = customers.filter(c => c.visitCount > 0).length;
    const withoutContact = customers.filter(c => c.segment === "no_contact").length;
    const vip = customers.filter(c => c.segment === "vip").length;
    const banned = customers.filter(c => c.segment === "banned").length;
    const marketing = customers.filter(c => c.segment === "marketing").length;

    return {
      total,
      withBookings,
      withoutContact,
      vip,
      banned,
      marketing
    };
  }, [customers]);

  // Clientes filtrados
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers];

    // Búsqueda
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm)
      );
    }

    // Filtro de visitas
    if (visitFilter === "with") {
      filtered = filtered.filter(c => c.visitCount > 0);
    } else if (visitFilter === "without") {
      filtered = filtered.filter(c => c.visitCount === 0);
    }

    // Filtro de actividad
    if (activityFilter === "active90") {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      filtered = filtered.filter(c =>
        c.lastVisit && new Date(c.lastVisit) > ninetyDaysAgo
      );
    } else if (activityFilter === "inactive90") {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      filtered = filtered.filter(c =>
        !c.lastVisit || new Date(c.lastVisit) <= ninetyDaysAgo
      );
    }

    // Filtro de segmento
    if (segmentFilter !== "all") {
      filtered = filtered.filter(c => c.segment === segmentFilter);
    }

    // Ordenamiento
    if (sortOption === "value") {
      filtered.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    }

    return filtered;
  }, [customers, searchTerm, visitFilter, activityFilter, segmentFilter, sortOption]);

  // Estadísticas filtradas
  const filteredStats = useMemo(() => {
    const total = filteredCustomers.length;
    const withBookings = filteredCustomers.filter(c => c.visitCount > 0).length;
    const withoutContact = filteredCustomers.filter(c => c.segment === "no_contact").length;
    const vip = filteredCustomers.filter(c => c.segment === "vip").length;
    const banned = filteredCustomers.filter(c => c.segment === "banned").length;
    const marketing = filteredCustomers.filter(c => c.segment === "marketing").length;

    return {
      total,
      withBookings,
      withoutContact,
      vip,
      banned,
      marketing
    };
  }, [filteredCustomers]);

  // Paginación
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  // Handlers
  const handleSelectCustomer = useCallback((customerId: string, selected: boolean) => {
    setSelectedCustomers(prev =>
      selected
        ? [...prev, customerId]
        : prev.filter(id => id !== customerId)
    );
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedCustomers(paginatedCustomers.map(c => c.id));
    } else {
      setSelectedCustomers([]);
    }
  }, [paginatedCustomers]);

  const clearSelection = useCallback(() => {
    setSelectedCustomers([]);
    setSelectionActive(false);
  }, []);

  const handleBulkExport = useCallback(async () => {
    console.log("Exportando clientes seleccionados");
  }, [selectedCustomers]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedCustomers.length === 0) return;

    const confirmed = confirm(
      `¿Estás seguro de que quieres eliminar ${selectedCustomers.length} ${selectedCustomers.length === 1 ? 'cliente' : 'clientes'}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      const { success } = await deleteCustomers(selectedCustomers);

      if (success) {
        // Limpiar selección
        setSelectedCustomers([]);
        setSelectionActive(false);
      }
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedCustomers, deleteCustomers]);

  const handleExportCsv = useCallback(() => {
    console.log("Exportando todos los clientes a CSV");
  }, []);

  const handleNewCustomer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setLoading(true);
    try {
      const payload = {
        id: editingCustomer?.id,
        full_name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        segment: newCustomer.segment,
        notes: newCustomer.notes
      };

      const result = await saveCustomer(payload);

      if (result.success) {
        setShowNewModal(false);
        setEditingCustomer(null);
        setNewCustomer({
          name: "",
          email: "",
          phone: "",
          segment: "normal",
          notes: ""
        });
      }
    } finally {
      setLoading(false);
    }
  }, [newCustomer, tenantId, editingCustomer, saveCustomer]);

  const handleEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    // TODO: Include notes if available in customer object
    setNewCustomer({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      segment: customer.segment,
      notes: ""
    });
    setShowNewModal(true);
  }, []);

  const handleDeleteCustomer = useCallback(async (customerId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;

    await deleteCustomers([customerId]);
  }, [deleteCustomers]);

  const handleViewHistory = useCallback((customerId: string) => {
    setShowHistory(customerId);
  }, []);

  const openNewModal = useCallback(() => {
    setEditingCustomer(null);
    setNewCustomer({
      name: "",
      email: "",
      phone: "",
      segment: "normal",
      notes: ""
    });
    setShowNewModal(true);
  }, []);

  const closeNewModal = useCallback(() => {
    setShowNewModal(false);
    setEditingCustomer(null);
  }, []);

  // Estados de selección
  const selectAll = selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0;
  const selectionCount = selectedCustomers.length;

  useEffect(() => {
    setSelectionActive(selectedCustomers.length > 0);
  }, [selectedCustomers]);

  if (error && !tenantId) {
    return (
      <div className="p-6">
        <GlassToast
          message={error.message || "Error desconocido"}
          tone="danger"
        />
      </div>
    );
  }

  return (
    <ProtectedRoute requiredPermission="clientes">
      <div className="space-y-6">
        {/* Header Glass */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pt-2">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold text-white tracking-tight leading-[1.2]">
              Clientes
            </h1>
            <p className="text-[11px] sm:text-[12px] text-[var(--text-secondary)]">
              Gestiona tu base de datos de clientes y visitas
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <GlassButton
              variant="secondary"
              onClick={handleExportCsv}
              disabled={isLoading}
              className="w-full sm:w-auto"
              leftIcon={<Download className="w-4 h-4" />}
            >
              Exportar CSV
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={openNewModal}
              className="w-full sm:w-auto"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Nuevo Cliente
            </GlassButton>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard className="p-4" noPadding={false}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Total Clientes</span>
            </div>
            <div className="text-2xl font-bold text-white">{customerStats.total}</div>
          </GlassCard>

          <GlassCard className="p-4" noPadding={false}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <Calendar className="h-4 w-4 text-blue-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Con Reservas</span>
            </div>
            <div className="text-2xl font-bold text-white">{customerStats.withBookings}</div>
          </GlassCard>

          <GlassCard className="p-4" noPadding={false}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Star className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">VIP</span>
            </div>
            <div className="text-2xl font-bold text-white">{customerStats.vip}</div>
          </GlassCard>

          <GlassCard className="p-4" noPadding={false}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Users className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-medium">Sin Contacto</span>
            </div>
            <div className="text-2xl font-bold text-white">{customerStats.withoutContact}</div>
          </GlassCard>
        </div>

        {/* Filters Section */}
        <GlassSection title="Filtros y Búsqueda" containerClassName="bg-white/[0.02]">
          <div className="space-y-4">
            <GlassInput
              placeholder="Buscar por nombre, email o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border-white/10"
            />

            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <GlassSelect
                label="Visitas"
                value={visitFilter}
                onChange={(e) => setVisitFilter(e.target.value as typeof visitFilter)}
                className="h-11"
              >
                <option value="all">Todas</option>
                <option value="with">Con reservas</option>
                <option value="without">Sin reservas</option>
              </GlassSelect>

              <GlassSelect
                label="Actividad"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as typeof activityFilter)}
                className="h-11"
              >
                <option value="all">Todas</option>
                <option value="active90">Activas 90d</option>
                <option value="inactive90">Inactivas +90d</option>
              </GlassSelect>

              <GlassSelect
                label="Segmento"
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value as typeof segmentFilter)}
                className="h-11"
              >
                <option value="all">Todos</option>
                <option value="vip">VIP</option>
                <option value="banned">Baneados</option>
                <option value="marketing">Marketing</option>
                <option value="no_contact">Sin contacto</option>
              </GlassSelect>

              <GlassSelect
                label="Ordenar"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                className="h-11"
              >
                <option value="recent">Recientes</option>
                <option value="value">Mayor gasto</option>
              </GlassSelect>
            </div>

            {/* Filtered Stats Summary */}
            {(filteredStats.total !== customerStats.total || searchTerm || visitFilter !== "all" || activityFilter !== "all" || segmentFilter !== "all") && (
              <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {Object.entries(filteredStats).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-[9px] uppercase tracking-wide text-[var(--text-secondary)]">{key === 'withBookings' ? 'Reservas' : key === 'withoutContact' ? 'Sin contacto' : key}</p>
                    <p className="font-mono font-bold text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassSection>

        {/* Toast Notifications - handled globally now, but keeping component if strictly needed for other non-hook errors */}
        {/*
          showToast && toastMessage && (
            <GlassToast
              message={toastMessage}
              tone={toastType === "error" ? "danger" : toastType as any}
              onClose={() => setShowToast(false)}
            />
          )
        */}

        {/* Bulk Actions Bar */}
        {
          selectionActive && (
            <GlassCard className="bg-emerald-500/10 border-emerald-500/20 sticky bottom-4 z-20 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-white font-medium">
                    {selectionCount} clientes seleccionados
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    onClick={handleBulkExport}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? "..." : "Exportar"}
                  </GlassButton>
                  <GlassButton
                    variant="danger"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? "Eliminando..." : "Eliminar"}
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={bulkActionLoading}
                  >
                    Cancelar
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          )
        }

        <CustomersGrid
          customers={paginatedCustomers}
          selectedCustomers={selectedCustomers}
          onSelectCustomer={handleSelectCustomer}
          onSelectAll={handleSelectAll}
          onViewHistory={handleViewHistory}
          onEdit={handleEditCustomer}
          onDelete={handleDeleteCustomer}
          isFiltered={searchTerm !== "" || visitFilter !== "all" || activityFilter !== "all" || segmentFilter !== "all"}
          onNewCustomer={openNewModal}
        />

        {
          totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Mostrando {paginatedCustomers.length} de {customerStats.total} clientes
              </p>
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </GlassButton>
                <span className="text-sm text-[var(--color-text-primary)] font-medium bg-white/5 px-2 py-1 rounded">
                  Página {currentPage} de {totalPages}
                </span>
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </GlassButton>
              </div>
            </div>
          )
        }

        <GlassModal
          isOpen={showNewModal}
          onClose={closeNewModal}
          title={editingCustomer ? "Editar cliente" : "Nuevo cliente"}
          description={editingCustomer ? "Modifica los datos del cliente." : "Rellena los datos para crear un nuevo cliente."}
          footer={
            <div className="flex items-center justify-end gap-3">
              <GlassButton
                variant="secondary"
                onClick={closeNewModal}
              >
                Cancelar
              </GlassButton>
              <GlassButton
                variant="primary"
                type="submit"
                form="customer-form"
                disabled={loading}
              >
                {loading ? "Guardando..." : editingCustomer ? "Actualizar" : "Crear cliente"}
              </GlassButton>
            </div>
          }
        >
          <form id="customer-form" onSubmit={handleNewCustomer} className="space-y-4">
            <GlassInput
              label="Nombre completo"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="Juan Pérez"
              required
            />

            <GlassInput
              label="Email"
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              placeholder="juan@ejemplo.com"
            />

            <GlassInput
              label="Teléfono"
              type="tel"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="+34 600 000 000"
            />

            <GlassSelect
              label="Segmento"
              value={newCustomer.segment}
              onChange={(e) => setNewCustomer({ ...newCustomer, segment: e.target.value as any })}
            >
              <option value="normal">Normal</option>
              <option value="vip">VIP</option>
              <option value="marketing">Marketing</option>
              <option value="no_contact">Sin contacto</option>
            </GlassSelect>
          </form>
        </GlassModal>

        {
          <GlassModal
            isOpen={!!showHistory}
            onClose={() => setShowHistory(null)}
            title="Historial de reservas"
            size="lg"
          >
            <div className="p-8 text-center flex flex-col items-center justify-center opacity-70">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-[var(--text-secondary)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                El componente de historial está en desarrollo (Fase D.3.2.c/f).
              </p>
            </div>
          </GlassModal>
        }
      </div >
    </ProtectedRoute >
  );
}
