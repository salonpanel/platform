"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { fetchTenantStaffOptions } from "@/lib/staff/fetchTenantStaffOptions";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { updateServiceStaff } from "@/lib/staff/staffServicesRelations";
import {
  GlassButton,
  GlassCard,
  GlassSelect,
  GlassBadge,
  GlassModal,
  GlassSection,
  GlassEmptyState,
} from "@/components/ui/glass";
import { Loader2, Plus, X, Search, AlertCircle } from "lucide-react";
import { ServiceCard } from "./components/ServiceCard";
import { ServiceForm } from "./components/ServiceForm";
import { ServicePreviewModal } from "./components/ServicePreviewModal";
import {
  DEFAULT_CATEGORY,
  buildDefaultFormState,
  normalizeService,
  usePagination,
  useServiceStats,
} from "./hooks";
import type {
  Service,
  ServiceFilters,
  ServiceFormState,
  SortOption,
} from "./types";



import { useServicesHandlers } from "@/hooks/useServicesHandlers";

const PAGE_SIZE_OPTIONS = [8, 12, 24, 48];

const STATUS_OPTIONS: Array<{ value: ServiceFilters["status"]; label: string }> =
  [
    { value: "all", label: "Todos" },
    { value: "active", label: "Activos" },
    { value: "inactive", label: "Archivados" },
  ];

const CATEGORY_OPTIONS = [
  "General",
  "Peluquería",
  "Estética",
  "Uñas",
  "Corporal",
  "Facial",
  "Masajes",
  "Otros",
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "name", label: "Nombre (A-Z)" },
  { value: "duration", label: "Duración asc." },
  { value: "price", label: "Precio asc." },
];

const formatEuros = (value: number) => `${value.toFixed(2)} €`;

type QuickFilterId = "noCategory" | "noBuffer";

type ServiciosClientProps = {
  tenantId: string;
  initialServices: Service[];
};

export function ServiciosClient({
  tenantId,
  initialServices,
}: ServiciosClientProps) {
  const supabase = getSupabaseBrowser();
  const [services, setServices] = useState<Service[]>(() =>
    (initialServices || []).map(normalizeService)
  );
  const [form, setForm] = useState<ServiceFormState>(() =>
    buildDefaultFormState()
  );
  const [loading, setLoading] = useState(!initialServices.length);
  const [saving, setSaving] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [previewService, setPreviewService] = useState<Service | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  // UI State for modals
  const [servicePendingArchive, setServicePendingArchive] = useState<Service | null>(null);
  const [servicePendingHardDelete, setServicePendingHardDelete] = useState<Service | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [staffOptions, setStaffOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [staffOptionsLoading, setStaffOptionsLoading] = useState(false);

  // Hook Handlers
  const { saveService, duplicateService: duplicateServiceHandler, deleteService } = useServicesHandlers({ tenantId, onAfterMutation: () => loadServices() });

  const [filterStatus, setFilterStatus] =
    useState<ServiceFilters["status"]>("active");
  const [filterCategory, setFilterCategory] = useState("all");
  const [bufferFilter, setBufferFilter] =
    useState<ServiceFilters["buffer"]>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 🚀 OPTIMIZACIÓN: Los filtros ahora se pasan directamente a get_services_filtered RPC
  // Ya no necesitamos el objeto filters para filtrado en cliente

  const priceBounds = useMemo(() => {
    if (!services.length) return { min: 0, max: 0 };
    const values = services.map((service) => service.price_cents / 100);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [services]);

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>([DEFAULT_CATEGORY]);
    services.forEach((service) =>
      unique.add(service.category ?? DEFAULT_CATEGORY)
    );
    return Array.from(unique);
  }, [services]);

  const handleFormChange = useCallback(
    (patch: Partial<ServiceFormState>) => {
      setForm((prev) => ({
        ...prev,
        ...patch,
        pricing_levels:
          patch.pricing_levels !== undefined
            ? {
              ...prev.pricing_levels,
              ...patch.pricing_levels,
            }
            : prev.pricing_levels,
      }));
    },
    []
  );

  const loadServices = useCallback(
    async (options?: { showLoader?: boolean; allowEmpty?: boolean }) => {
      if (!tenantId) return;
      if (options?.showLoader) {
        setLoading(true);
      }
      try {
        setPageError(null);

        // 🚀 OPTIMIZACIÓN: Usar manage_list_services con filtros del servidor
        const { data, error } = await supabase.rpc('manage_list_services', {
          p_tenant_id: tenantId,
          p_status: filterStatus,
          p_category: filterCategory !== 'all' ? filterCategory : null,
          p_search_term: searchTerm || null,
          p_sort_by: sortBy,
          p_sort_direction: 'asc',
        });

        if (error) {
          throw new Error(error.message);
        }
        const normalized = ((data as Service[]) || []).map(normalizeService);

        // Si ya teníamos servicios y la recarga devuelve 0 inesperadamente,
        // preservar la lista actual cuando allowEmpty es false (p.ej. en Reintentar).
        if (!options?.allowEmpty && services.length > 0 && normalized.length === 0) {
          setPageError(
            "No se pudieron recargar los servicios. Inténtalo de nuevo o recarga la página."
          );
          return;
        }

        setServices(normalized);
      } catch (err: any) {
        setPageError(err?.message || "Error al cargar servicios");
      } finally {
        if (options?.showLoader) {
          setLoading(false);
        }
      }
    },
    [supabase, tenantId, filterStatus, filterCategory, searchTerm, sortBy, services.length]
  );

  // Cargar servicios inicialmente cuando el componente se monta o tenantId cambia
  useEffect(() => {
    if (tenantId) {
      loadServices({ showLoader: true });
    }
  }, [tenantId, loadServices]);

  // 🔥 Recargar servicios cuando cambien los filtros (debounce para evitar llamadas excesivas)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tenantId) {
        loadServices({ showLoader: false });
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [filterStatus, filterCategory, priceRange, bufferFilter, searchTerm, sortBy, tenantId, loadServices]);

  const openNewModal = useCallback(
    (defaults?: Partial<ServiceFormState>) => {
      setEditingService(null);
      setForm({
        ...buildDefaultFormState(),
        ...defaults,
      });
      setModalError(null);
      setSuccessMessage(null);
      setShowModal(true);
    },
    []
  );

  const mapServiceToForm = useCallback(
    (service: Service, overrides?: Partial<ServiceFormState>) => {
      const base = buildDefaultFormState();
      return {
        ...base,
        name: service.name,
        duration_min: service.duration_min,
        buffer_min: service.buffer_min ?? 0,
        price_cents: service.price_cents,
        category: service.category ?? DEFAULT_CATEGORY,
        pricing_levels: {
          ...base.pricing_levels,
          ...(service.pricing_levels ?? {}),
        },
        active: service.active,
        description: service.description ?? base.description,
        media_url: service.media_url ?? base.media_url,
        vip_tier: service.vip_tier ?? base.vip_tier,
        combo_service_ids:
          service.combo_service_ids && service.combo_service_ids.length > 0
            ? service.combo_service_ids
            : base.combo_service_ids,
        duration_variants: service.duration_variants ?? base.duration_variants,
        ...overrides,
      };
    },
    []
  );

  const openEditModal = useCallback(
    async (service: Service) => {
      setEditingService(service);
      setSuccessMessage(null);
      setForm(mapServiceToForm(service));
      setModalError(null);

      // Load current staff assignments
      try {
        const { getServiceStaff } = await import("@/lib/staff/staffServicesRelations");
        const staffIds = await getServiceStaff(service.id, tenantId);
        setSelectedStaffIds(staffIds);
      } catch (error) {
        console.error("Error loading staff assignments:", error);
        setSelectedStaffIds([]);
      }

      setShowModal(true);
    },
    [mapServiceToForm, tenantId]
  );

  const duplicateService = useCallback(
    (service: Service) => {
      setEditingService(null);
      setSuccessMessage(null);
      setForm(
        mapServiceToForm(service, {
          name: `${service.name} (copia)`,
          active: false,
        })
      );
      setModalError(null);
      setShowModal(true);
    },
    [mapServiceToForm]
  );

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingService(null);
    setSelectedStaffIds([]);
    setModalError(null);
    setForm(buildDefaultFormState());
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!tenantId || !form.name.trim() || saving) return;

    if (form.duration_min < 5) {
      setModalError("La duración mínima es de 5 minutos.");
      return;
    }

    if (form.buffer_min < 0) {
      setModalError("El buffer no puede ser negativo.");
      return;
    }

    if (form.price_cents < 0) {
      setModalError("El precio no puede ser negativo.");
      return;
    }

    const hasInvalidLevel = Object.values(form.pricing_levels).some(
      (value) => value != null && value < 0
    );
    if (hasInvalidLevel) {
      setModalError("Las tarifas por nivel no pueden ser negativas.");
      return;
    }

    setModalError(null);
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      duration_min: form.duration_min,
      buffer_min: form.buffer_min,
      price_cents: form.price_cents,
      active: form.active,
      category: form.category.trim() || DEFAULT_CATEGORY,
      pricing_levels: form.pricing_levels,
      description: form.description,
      // media_url: form.media_url, // TODO: Add support for media in RPC if needed
      // vip_tier: form.vip_tier,
      // combo_service_ids: form.combo_service_ids,
      // duration_variants: form.duration_variants
    };

    setSaving(true);
    try {
      // 1. Save Service
      const result = await saveService({
        id: editingService?.id,
        ...payload
      });

      if (!result.success || !result.serviceId) {
        // Error is handled by hook toast
        return;
      }

      // 2. Handle Staff Assignments
      // Update staff assignments using the returned serviceId
      await updateServiceStaff(tenantId, result.serviceId, selectedStaffIds);

      // 3. Success
      closeModal();
      // loadServices is called automatically via onAfterMutation in hook
    } catch (err: any) {
      setModalError(err?.message || "Error al guardar servicio");
    } finally {
      setSaving(false);
    }
  }, [tenantId, form, saving, editingService, selectedStaffIds, saveService, closeModal]);

  const toggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      const service = services.find((s) => s.id === id);
      if (!service) return;

      setTogglingId(id);
      try {
        await saveService({
          ...mapServiceToForm(service),
          id: service.id,
          active: !currentActive,
        });
      } catch (err: any) {
        setPageError(err?.message || "Error al actualizar servicio");
      } finally {
        setTogglingId(null);
      }
    },
    [services, mapServiceToForm, saveService]
  );

  const handleDuplicateService = useCallback(
    async (service: Service) => {
      // Usar el handler del hook
      await duplicateServiceHandler(service.id);
      // El hook ya maneja toast y onAfterMutation llama a loadServices
    },
    [duplicateServiceHandler]
  );

  const handleRequestArchiveService = useCallback((service: Service) => {
    if (service.active) {
      setServicePendingArchive(service);
    } else {
      setServicePendingHardDelete(service);
    }
  }, []);

  const handleCancelArchiveService = useCallback(() => {
    setServicePendingArchive(null);
  }, []);

  const handleConfirmArchiveService = useCallback(async () => {
    if (!servicePendingArchive) return;

    setDeletingId(servicePendingArchive.id);
    try {
      await saveService({
        ...mapServiceToForm(servicePendingArchive),
        id: servicePendingArchive.id,
        active: false
      });
      // Hook maneja toast y reload
      setServicePendingArchive(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  }, [servicePendingArchive, saveService, mapServiceToForm]);

  const handleCancelHardDeleteService = useCallback(() => {
    setServicePendingHardDelete(null);
  }, []);

  const handleConfirmHardDeleteService = useCallback(async () => {
    if (!servicePendingHardDelete) return;

    setDeletingId(servicePendingHardDelete.id);
    try {
      await deleteService(servicePendingHardDelete.id);
      // Hook maneja toast y reload
      setServicePendingHardDelete(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  }, [servicePendingHardDelete, deleteService]);

  const handleRetry = useCallback(() => {
    // En reintentos, no vaciar la lista actual si la recarga devuelve 0
    // de forma inesperada. Solo aceptar vacío cuando allowEmpty es true.
    loadServices({ showLoader: true, allowEmpty: false });
  }, [loadServices]);

  const clearFilters = useCallback(() => {
    setFilterStatus("all");
    setFilterCategory("all");
    setBufferFilter("all");
    setSortBy("name");
    setSearchInput("");
    setSearchTerm("");
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds.min, priceBounds.max]);

  const stats = useServiceStats(services);

  // 🚀 OPTIMIZACIÓN: El filtrado ahora se hace en el servidor con get_services_filtered
  // Ya no necesitamos filtrar en el cliente, solo paginar
  const filteredServices = services; // Los servicios ya vienen filtrados del servidor

  const {
    paginatedItems,
    currentPage,
    totalPages,
    goToPage,
  } = usePagination(filteredServices, pageSize);

  useEffect(() => {
    if (!tenantId) return;
    if (!initialServices.length) {
      // En la carga inicial sí permitimos que la lista sea realmente vacía
      loadServices({ showLoader: true, allowEmpty: true });
    } else {
      setLoading(false);
    }
  }, [tenantId, initialServices.length, loadServices]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`rt-services-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "services",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => loadServices()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tenantId, loadServices]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    if (!services.length) {
      setPriceRange([0, 0]);
      return;
    }
    setPriceRange((prev) => {
      if (prev[0] === 0 && prev[1] === 0) {
        return [priceBounds.min, priceBounds.max];
      }
      return [
        Math.max(priceBounds.min, Math.min(prev[0], priceBounds.max)),
        Math.max(priceBounds.min, Math.min(prev[1], priceBounds.max)),
      ];
    });
  }, [priceBounds.min, priceBounds.max, services.length]);

  useEffect(() => {
    // 🔒 GUARDRAIL: Do not execute if modal is closed or tenant is not ready
    if (!showModal || !tenantId) {
      if (process.env.NODE_ENV === "development" && showModal && !tenantId) {
        console.warn("[ServiciosClient] ⚠️ Modal opened but tenantId not ready yet");
      }
      return;
    }

    // 🔍 DEV LOGGING: Track staff loading trigger
    if (process.env.NODE_ENV === "development") {
      console.log("[ServiciosClient] 🔄 Loading staff options for modal with tenantId:", tenantId);
    }

    const loadStaffOptions = async () => {
      setStaffOptionsLoading(true);
      try {
        const options = await fetchTenantStaffOptions(tenantId);
        setStaffOptions(options);

        // 🔍 DEV LOGGING: Track results
        if (process.env.NODE_ENV === "development") {
          console.log("[ServiciosClient] ✅ Staff options loaded:", { count: options.length, options });
        }
      } catch (err) {
        console.error("Error fetching staff options:", err);
        setStaffOptions([]);
      } finally {
        setStaffOptionsLoading(false);
      }
    };

    loadStaffOptions();
  }, [showModal, tenantId]);

  const hasServices = services.length > 0;
  const hasFiltersApplied =
    filterStatus !== "all" ||
    filterCategory !== "all" ||
    bufferFilter !== "all" ||
    Boolean(searchTerm) ||
    (services.length > 0 &&
      (priceRange[0] > priceBounds.min || priceRange[1] < priceBounds.max));
  const filteredIsEmpty = hasServices && filteredServices.length === 0;
  const priceSliderDisabled = priceBounds.max <= priceBounds.min;

  const filterSummaryText = useMemo(() => {
    const parts = [
      `Estado: ${filterStatus === "all"
        ? "Todos"
        : filterStatus === "active"
          ? "Activos"
          : "Inactivos"
      }`,
      `Categoría: ${filterCategory === "all" ? "Todas" : filterCategory}`,
    ];
    if (bufferFilter === "no_buffer") {
      parts.push("Buffer: sin buffer");
    }
    if (searchTerm) {
      parts.push(`Búsqueda: "${searchTerm}"`);
    }
    return parts.join(" · ");
  }, [filterStatus, filterCategory, bufferFilter, searchTerm]);

  const quickAlerts = useMemo(() => {
    const alerts: Array<{
      id: QuickFilterId;
      label: string;
      count: number;
      active: boolean;
    }> = [];
    if (stats.withoutCategory > 0) {
      alerts.push({
        id: "noCategory",
        label: `${stats.withoutCategory} sin categoría`,
        count: stats.withoutCategory,
        active: filterCategory === DEFAULT_CATEGORY,
      });
    }
    if (stats.withoutBuffer > 0) {
      alerts.push({
        id: "noBuffer",
        label: `${stats.withoutBuffer} sin buffer`,
        count: stats.withoutBuffer,
        active: bufferFilter === "no_buffer",
      });
    }
    return alerts;
  }, [stats, filterCategory, bufferFilter]);

  const handleQuickFilter = useCallback(
    (id: QuickFilterId) => {
      switch (id) {
        case "noCategory":
          setFilterCategory((prev) =>
            prev === DEFAULT_CATEGORY ? "all" : DEFAULT_CATEGORY
          );
          break;
        case "noBuffer":
          setBufferFilter((prev) =>
            prev === "no_buffer" ? "all" : "no_buffer"
          );
          break;
        default:
          break;
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Controles principales */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <GlassButton
            onClick={() => openNewModal()}
            className="flex-1 sm:flex-none h-11"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Nuevo Servicio
          </GlassButton>
        </div>
      </div>

      <GlassCard className="p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            Mostrando {filteredServices.length} de {services.length} servicios ·{" "}
            {filterSummaryText}
          </p>
          <GlassButton variant="ghost" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </GlassButton>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2">
          {/* Price Range Inputs would go here but we should use proper components */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[var(--text-secondary)]">Mínimo (€)</label>
            <input
              type="number"
              min={priceBounds.min}
              max={priceRange[1]}
              value={priceRange[0]}
              disabled={priceSliderDisabled}
              onChange={(e) => setPriceRange(prev => [Math.min(Number(e.target.value), prev[1]), prev[1]])}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[var(--text-secondary)]">Máximo (€)</label>
            <input
              type="number"
              min={priceRange[0]}
              max={priceBounds.max || 100}
              value={priceRange[1]}
              disabled={priceSliderDisabled}
              onChange={(e) => setPriceRange(prev => [prev[0], Math.max(Number(e.target.value), prev[0])])}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white"
            />
          </div>
        </div>
      </GlassCard>

      {
        successMessage && (
          <GlassCard className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
            <p className="text-sm font-medium">{successMessage}</p>
          </GlassCard>
        )
      }

      {
        pageError && (
          <GlassCard className="border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Error</h3>
                  <p className="text-sm text-red-300">{pageError}</p>
                </div>
              </div>
              <GlassButton size="sm" variant="secondary" onClick={handleRetry}>
                Reintentar
              </GlassButton>
            </div>
          </GlassCard>
        )
      }

      {/* Service List State Logic */}
      {
        !hasServices && !loading && !filteredIsEmpty ? (
          <GlassEmptyState
            icon={Plus}
            title="Comienza añadiendo servicios"
            description="Crea tu primer servicio para que los clientes puedan empezar a reservar citas."
            actionLabel="Crear Primer Servicio"
            onAction={() => openNewModal()}
            variant="default"
          />
        ) : filteredIsEmpty ? (
          <GlassEmptyState
            icon={Search}
            title="Sin resultados"
            description="No se encontraron servicios que coincidan con los filtros actuales."
            actionLabel={hasFiltersApplied ? "Limpiar filtros" : undefined}
            onAction={hasFiltersApplied ? clearFilters : undefined}
            variant="default"
          />
        ) : (
          <>
            <div className="relative">
              <div
                className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${gridLoading ? "opacity-60" : "opacity-100"
                  } transition`}
              >
                {paginatedItems.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onPreview={setPreviewService}
                    onEdit={openEditModal}
                    onDuplicate={handleDuplicateService}
                    onToggleActive={toggleActive}
                    onDelete={handleRequestArchiveService}
                    isToggling={
                      togglingId === service.id || deletingId === service.id
                    }
                  />
                ))}
              </div>
              {gridLoading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Anterior
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </GlassButton>
                <p className="text-sm text-white/70">
                  Página {currentPage} de {totalPages}
                </p>
              </div>
              <div className="text-sm text-white/70">
                Mostrando {paginatedItems.length} de {filteredServices.length} servicios
                filtrados
              </div>
            </div>
          </>
        )
      }

      <GlassModal
        isOpen={showModal}
        onClose={closeModal}
        title={editingService ? "Editar Servicio" : "Nuevo Servicio"}
        className="max-w-4xl"
      >
        {modalError && (
          <GlassCard className="border-red-500/50 bg-red-500/10 mb-6 p-4">
            <div className="flex justify-between items-start">
              <p className="text-sm text-red-400">{modalError}</p>
              <button
                onClick={() => setModalError(null)}
                className="text-red-400 hover:text-red-300"
                aria-label="Cerrar error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </GlassCard>
        )}

        <ServiceForm
          form={form}
          onChange={handleFormChange}
          saving={saving}
          isEditing={!!editingService}
          categoryOptions={CATEGORY_OPTIONS}
          staffOptions={staffOptions}
          staffOptionsLoading={staffOptionsLoading}
          tenantId={tenantId}
        />

        {/* Staff Assignment Section */}
        <div className="mt-8 pt-8 border-t border-white/5">
          <h3 className="text-lg font-semibold text-white mb-4 font-satoshi">Personal asignado</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Selecciona los empleados que pueden realizar este servicio.
          </p>

          {staffOptionsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {staffOptions.map(staff => (
                <div
                  key={staff.id}
                  className={`
                      relative flex items-center p-3 rounded-lg border cursor-pointer transition-all
                      ${selectedStaffIds.includes(staff.id)
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05]'}
                   `}
                  onClick={() => {
                    setSelectedStaffIds(prev =>
                      prev.includes(staff.id)
                        ? prev.filter(id => id !== staff.id)
                        : [...prev, staff.id]
                    );
                  }}
                >
                  <div className={`
                    w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors
                    ${selectedStaffIds.includes(staff.id)
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-white/30'}
                  `}>
                    {selectedStaffIds.includes(staff.id) && <Plus className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm ${selectedStaffIds.includes(staff.id) ? 'text-white font-medium' : 'text-[var(--text-secondary)]'}`}>
                    {staff.name}
                  </span>
                </div>
              ))}
              {staffOptions.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] italic col-span-2">No hay empleados disponibles.</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-white/5">
          <GlassButton
            variant="ghost"
            onClick={closeModal}
            disabled={saving}
          >
            Cancelar
          </GlassButton>
          <GlassButton
            onClick={handleSubmit}
            isLoading={saving}
            disabled={saving}
          >
            {editingService ? "Guardar Cambios" : "Crear Servicio"}
          </GlassButton>
        </div>
      </GlassModal>

      <ServicePreviewModal
        service={previewService}
        isOpen={Boolean(previewService)}
        onClose={() => setPreviewService(null)}
        onEdit={openEditModal}
        onDuplicate={handleDuplicateService}
        onToggleActive={toggleActive}
        onDelete={handleRequestArchiveService}
      />
    </div >
  );
}
