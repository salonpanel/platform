"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UiModal, UiToast, UiButton, UiField, UiInput } from "@/components/ui/apple-ui-kit";
import { GlassCard, GlassButton, GlassInput, GlassSelect, GlassSection } from "@/components/ui/glass";
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
  const supabase = getSupabaseBrowser();

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(error ? "Error al cargar los clientes" : null);

  // Estados de loading
  const [loading, setLoading] = useState(false); // Para operaciones específicas (crear/editar)

  // Estados de toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

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
    segment: "normal" as "normal" | "vip" | "marketing" | "no_contact"
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
      console.log("Eliminando clientes seleccionados:", selectedCustomers);

      // Eliminar clientes uno por uno (podríamos optimizar esto con una query batch si Supabase lo soporta)
      const deletePromises = selectedCustomers.map(customerId =>
        supabase
          .from("customers")
          .delete()
          .eq("id", customerId)
      );

      const results = await Promise.all(deletePromises);

      // Verificar si alguna eliminación falló
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        console.error("Errores al eliminar clientes:", errors);
        throw new Error(`Error al eliminar ${errors.length} cliente(s)`);
      }

      console.log(`✅ Eliminados ${selectedCustomers.length} clientes exitosamente`);

      // Invalidar el cache para forzar recarga de datos
      invalidateCache(`customers-page-${impersonateOrgId || 'default'}`);

      // Limpiar selección
      setSelectedCustomers([]);
      setSelectionActive(false);

      // Mostrar mensaje de éxito
      setToastMessage(`${selectedCustomers.length} ${selectedCustomers.length === 1 ? 'cliente eliminado' : 'clientes eliminados'} exitosamente`);
      setToastType("success");
      setShowToast(true);

    } catch (err) {
      console.error("Error en eliminación masiva:", err);
      setToastMessage("Error al eliminar los clientes seleccionados");
      setToastType("error");
      setShowToast(true);
    } finally {
      setBulkActionLoading(false);
    }
  }, [selectedCustomers, supabase, impersonateOrgId]);

  const handleExportCsv = useCallback(() => {
    console.log("Exportando todos los clientes a CSV");
  }, []);

  const handleNewCustomer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setLoading(true);
    try {
      const customerData = editingCustomer ? {
        ...newCustomer,
        id: editingCustomer.id
      } : {
        ...newCustomer,
        tenant_id: tenantId,
        created_at: new Date().toISOString()
      };

      const { data, error } = editingCustomer
        ? await supabase
          .from("customers")
          .update(customerData)
          .eq("id", editingCustomer.id)
          .select()
          .single()
        : await supabase
          .from("customers")
          .insert([customerData])
          .select()
          .single();

      if (error) throw error;

      // Actualizar la lista de clientes (esto debería invalidar el caché del hook)
      // Por ahora, forzamos una recarga del hook invalidando el caché

      setToastMessage(editingCustomer ? "Cliente actualizado exitosamente" : "Cliente creado exitosamente");
      setToastType("success");
      setShowToast(true);
      setShowNewModal(false);
      setEditingCustomer(null);
      setNewCustomer({
        name: "",
        email: "",
        phone: "",
        segment: "normal"
      });

      // Invalidar cache después de la operación
      invalidateCache(`customers-page-${impersonateOrgId || 'default'}`);
    } catch (err) {
      console.error("Error saving customer:", err);
      setToastMessage("Error al guardar el cliente");
      setToastType("error");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  }, [newCustomer, tenantId, supabase, editingCustomer, impersonateOrgId]);

  const handleEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setShowNewModal(true);
  }, []);

  const handleDeleteCustomer = useCallback(async (customerId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return;

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;

      // Invalidar el cache para forzar recarga de datos
      invalidateCache(`customers-page-${impersonateOrgId || 'default'}`);

      // La lista se actualizará automáticamente cuando el hook invalide el caché
      setToastMessage("Cliente eliminado exitosamente");
      setToastType("success");
      setShowToast(true);
    } catch (err) {
      console.error("Error deleting customer:", err);
      setToastMessage("Error al eliminar el cliente");
      setToastType("error");
      setShowToast(true);
    }
  }, [supabase, impersonateOrgId]);

  const handleViewHistory = useCallback((customerId: string) => {
    setShowHistory(customerId);
  }, []);

  const openNewModal = useCallback(() => {
    setEditingCustomer(null);
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
        <UiToast
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

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              <GlassSelect
                label="Visitas"
                value={visitFilter}
                onChange={(e) => setVisitFilter(e.target.value as typeof visitFilter)}
              >
                <option value="all">Todas</option>
                <option value="with">Con reservas</option>
                <option value="without">Sin reservas</option>
              </GlassSelect>

              <GlassSelect
                label="Actividad"
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as typeof activityFilter)}
              >
                <option value="all">Todas</option>
                <option value="active90">Activas 90d</option>
                <option value="inactive90">Inactivas +90d</option>
              </GlassSelect>

              <GlassSelect
                label="Segmento"
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value as typeof segmentFilter)}
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

        {/* Toast Notifications */}
        {
          showToast && toastMessage && (
            <UiToast
              message={toastMessage}
              tone={toastType === "error" ? "danger" : toastType}
              onClose={() => setShowToast(false)}
            />
          )
        }

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

        {
          showNewModal && (
            <UiModal
              open={showNewModal}
              onClose={closeNewModal}
              title={editingCustomer ? "Editar cliente" : "Nuevo cliente"}
              footer={
                <div className="flex items-center justify-end gap-3">
                  <UiButton
                    variant="secondary"
                    onClick={closeNewModal}
                  >
                    Cancelar
                  </UiButton>
                  <UiButton
                    variant="primary"
                    type="submit"
                    form="customer-form"
                    disabled={loading}
                  >
                    {loading ? "Guardando..." : editingCustomer ? "Actualizar" : "Crear cliente"}
                  </UiButton>
                </div>
              }
            >
              <form id="customer-form" onSubmit={handleNewCustomer} className="space-y-6">
                <UiField label="Nombre completo" required>
                  <UiInput
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder="Juan Pérez"
                    required
                  />
                </UiField>

                <UiField label="Email">
                  <UiInput
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="juan@ejemplo.com"
                  />
                </UiField>

                <UiField label="Teléfono">
                  <UiInput
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="+34 600 000 000"
                  />
                </UiField>

                <UiField label="Segmento">
                  <select
                    value={newCustomer.segment}
                    onChange={(e) => setNewCustomer({ ...newCustomer, segment: e.target.value as any })}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                  >
                    <option value="normal">Normal</option>
                    <option value="vip">VIP</option>
                    <option value="marketing">Marketing</option>
                    <option value="no_contact">Sin contacto</option>
                  </select>
                </UiField>
              </form>
            </UiModal>
          )
        }

        {
          showHistory && (
            <UiModal
              open={!!showHistory}
              onClose={() => setShowHistory(null)}
              title="Historial de reservas"
              size="lg"
            >
              <div className="p-4 text-center text-slate-400">
                Historial de reservas (Componente en desarrollo)
              </div>
            </UiModal>
          )
        }
      </div >
    </ProtectedRoute >
  );
}
