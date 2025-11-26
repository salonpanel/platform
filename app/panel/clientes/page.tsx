"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { UiButton, UiCard, UiModal, UiInput, UiField, UiBadge, UiToast } from "@/components/ui/apple-ui-kit";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProtectedRoute } from "@/components/panel/ProtectedRoute";
// import { CustomerHistory } from "@/components/customers/CustomerHistory";
import { 
  Calendar, 
  Edit2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getCurrentTenant } from "@/lib/panel-tenant";
// import type { Customer } from "@/types/customers";

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
  const supabase = createClientComponentClient();
  
  // Estados principales
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showToast, setShowToast] = useState(false);
  
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
  
  // Estados del tenant
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantTimezone, setTenantTimezone] = useState<string>("Europe/Madrid");
  const [tenantError, setTenantError] = useState<string | null>(null);
  
  // Estado del nuevo cliente
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    segment: "normal" as "normal" | "vip" | "marketing" | "no_contact"
  });

  // Cargar información del tenant
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const tenant = await getCurrentTenant();
        if (tenant) {
          setTenantId((tenant as any).id);
          setTenantTimezone((tenant as any).timezone || "Europe/Madrid");
        } else {
          setTenantError("No se pudo cargar la información del tenant");
        }
      } catch (err) {
        console.error("Error loading tenant:", err);
        setTenantError("Error al cargar la información del tenant");
      }
    };
    
    loadTenant();
  }, []);

  // Cargar clientes
  const loadCustomers = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      setCustomers(data || []);
    } catch (err) {
      console.error("Error loading customers:", err);
      setError("Error al cargar los clientes");
    } finally {
      setLoading(false);
    }
  }, [tenantId, supabase]);

  useEffect(() => {
    if (tenantId) {
      loadCustomers();
    }
  }, [tenantId, loadCustomers]);

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
    console.log("Eliminando clientes seleccionados");
  }, [selectedCustomers]);

  const handleExportCsv = useCallback(() => {
    console.log("Exportando todos los clientes a CSV");
  }, []);

  const handleNewCustomer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([{
          ...newCustomer,
          tenant_id: tenantId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      setCustomers(prev => [data, ...prev]);
      setToastMessage("Cliente creado exitosamente");
      setToastType("success");
      setShowToast(true);
      setShowNewModal(false);
      setNewCustomer({
        name: "",
        email: "",
        phone: "",
        segment: "normal"
      });
    } catch (err) {
      console.error("Error creating customer:", err);
      setError("Error al crear el cliente");
    } finally {
      setLoading(false);
    }
  }, [newCustomer, tenantId, supabase]);

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
      
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setToastMessage("Cliente eliminado exitosamente");
      setToastType("success");
      setShowToast(true);
    } catch (err) {
      console.error("Error deleting customer:", err);
      setError("Error al eliminar el cliente");
    }
  }, [supabase]);

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

  if ((tenantError && !tenantId) || (error && !tenantId)) {
    return (
      <div className="p-6">
        <UiToast
          message={tenantError || error || "Error desconocido"}
          tone="danger"
        />
      </div>
    );
  }

  return (
    <ProtectedRoute requiredPermission="clientes">
      <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} ${customers.length === 1 ? "cliente" : "clientes"}`}
        description="Gestiona tu base de clientes, filtra y busca fácilmente, y accede a sus historiales de reservas."
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <UiButton
              variant="secondary"
              onClick={handleExportCsv}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Exportar CSV
            </UiButton>
            <UiButton
              variant="primary"
              onClick={openNewModal}
              className="w-full sm:w-auto"
            >
              + Nuevo Cliente
            </UiButton>
          </div>
        }
      />
      
      <div className="space-y-4">
        <UiInput
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <UiField label="Visitas">
            <select
              value={visitFilter}
              onChange={(e) => setVisitFilter(e.target.value as typeof visitFilter)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="all">Todas</option>
              <option value="with">Con reservas</option>
              <option value="without">Sin reservas</option>
            </select>
          </UiField>
          
          <UiField label="Actividad">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as typeof activityFilter)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="all">Todas</option>
              <option value="active90">Activas 90d</option>
              <option value="inactive90">Inactivas +90d</option>
            </select>
          </UiField>
          
          <UiField label="Segmento">
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value as typeof segmentFilter)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="all">Todos</option>
              <option value="vip">VIP</option>
              <option value="banned">Baneados</option>
              <option value="marketing">Marketing</option>
              <option value="no_contact">Sin contacto</option>
            </select>
          </UiField>
          
          <UiField label="Ordenar">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="recent">Recientes</option>
              <option value="value">Mayor gasto</option>
            </select>
          </UiField>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
              Total
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] font-satoshi">
              {customerStats.total}
            </p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
              Con reservas
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] font-satoshi">
              {customerStats.withBookings}
            </p>
          </div>
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
              Sin contacto
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] font-satoshi">
              {customerStats.withoutContact}
            </p>
          </div>
        </div>

        {(filteredStats.total !== customerStats.total || 
          searchTerm || 
          visitFilter !== "all" || 
          activityFilter !== "all" || 
          segmentFilter !== "all") && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                Visibles
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {filteredStats.total}
              </p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                VIP
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {filteredStats.vip}
              </p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                Baneados
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {filteredStats.banned}
              </p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                Marketing
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {filteredStats.marketing}
              </p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                Reservas
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {filteredStats.withBookings}
              </p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                Sin contacto
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {filteredStats.withoutContact}
              </p>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        {showToast && toastMessage && (
          <UiToast
            message={toastMessage}
            tone={toastType === "error" ? "danger" : toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>

      {selectionActive && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-medium">
              {selectionCount} {selectionCount === 1 ? "cliente seleccionado" : "clientes seleccionados"}
            </p>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <UiButton
                variant="secondary"
                onClick={handleBulkExport}
                disabled={bulkActionLoading}
                className="w-full sm:w-auto"
              >
                {bulkActionLoading ? "Exportando..." : "Exportar seleccionados"}
              </UiButton>
              <UiButton
                variant="danger"
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                className="w-full sm:w-auto"
              >
                {bulkActionLoading ? "Eliminando..." : "Eliminar seleccionados"}
              </UiButton>
              <UiButton
                variant="secondary"
                onClick={clearSelection}
                disabled={bulkActionLoading}
                className="w-full sm:w-auto"
              >
                Cancelar selección
              </UiButton>
            </div>
          </div>
        </div>
      )}

      <UiCard className="border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border)]">
                <th className="text-left p-3 sm:p-4">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] text-[var(--gradient-primary-start)] focus:ring-[var(--gradient-primary-start)]/30"
                  />
                </th>
                <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Cliente
                </th>
                <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Contacto
                </th>
                <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Visitas
                </th>
                <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Última visita
                </th>
                <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Segmento
                </th>
                <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className={`border-b border-[var(--glass-border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                    selectedCustomers.includes(customer.id) ? "bg-[rgba(79,227,193,0.05)]" : ""
                  }`}
                >
                  <td className="p-3 sm:p-4">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={(e) => handleSelectCustomer(customer.id, e.target.checked)}
                      className="rounded border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] text-[var(--gradient-primary-start)] focus:ring-[var(--gradient-primary-start)]/30"
                    />
                  </td>
                  <td className="p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--gradient-primary-start)] to-[var(--gradient-primary-end)] flex items-center justify-center text-white text-xs font-bold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {customer.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          ID: {customer.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 sm:p-4">
                    <div className="space-y-1">
                      {customer.email && (
                        <p className="text-sm text-[var(--color-text-primary)]">
                          {customer.email}
                        </p>
                      )}
                      {customer.phone && (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {customer.phone}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-3 sm:p-4">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {customer.visitCount || 0}
                    </p>
                  </td>
                  <td className="p-3 sm:p-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {customer.lastVisit 
                        ? format(new Date(customer.lastVisit), "dd MMM yyyy", { locale: es })
                        : "Nunca"
                      }
                    </p>
                  </td>
                  <td className="p-3 sm:p-4">
                    <UiBadge 
                      tone={
                        customer.segment === "vip" ? "highlight" :
                        customer.segment === "banned" ? "danger" :
                        customer.segment === "marketing" ? "info" :
                        "neutral"
                      }
                      soft
                    >
                      {customer.segment === "vip" ? "VIP" :
                       customer.segment === "banned" ? "Baneado" :
                       customer.segment === "marketing" ? "Marketing" :
                       customer.segment === "no_contact" ? "Sin contacto" : "Normal"}
                    </UiBadge>
                  </td>
                  <td className="p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <UiButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewHistory(customer.id)}
                      >
                        <Calendar className="w-4 h-4" />
                      </UiButton>
                      <UiButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCustomer(customer)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </UiButton>
                      <UiButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCustomer(customer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </UiButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </UiCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Mostrando {paginatedCustomers.length} de {customerStats.total} clientes
          </p>
          <div className="flex items-center gap-2">
            <UiButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </UiButton>
            <span className="text-sm text-[var(--color-text-primary)]">
              Página {currentPage} de {totalPages}
            </span>
            <UiButton
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </UiButton>
          </div>
        </div>
      )}

      {showNewModal && (
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
                onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                placeholder="Juan Pérez"
                required
              />
            </UiField>

            <UiField label="Email">
              <UiInput
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                placeholder="juan@ejemplo.com"
              />
            </UiField>

            <UiField label="Teléfono">
              <UiInput
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                placeholder="+34 600 000 000"
              />
            </UiField>

            <UiField label="Segmento">
              <select
                value={newCustomer.segment}
                onChange={(e) => setNewCustomer({...newCustomer, segment: e.target.value as any})}
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
      )}

      {showHistory && (
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
      )}
      </div>
    </ProtectedRoute>
  );
}
