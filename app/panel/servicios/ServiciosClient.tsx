"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { fetchTenantStaffOptions } from "@/lib/staff/fetchTenantStaffOptions";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { updateServiceStaff } from "@/lib/staff/staffServicesRelations";
import {
  GlassButton,
  GlassCard,
  GlassModal,
  GlassEmptyState,
} from "@/components/ui/glass";
import { Slider } from "@/components/ui/Slider";
import { Loader2, Plus, X, Search, AlertCircle, LayoutGrid, Tag, SlidersHorizontal } from "lucide-react";
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

function normalizeServicesPageError(err: any): string {
  const raw =
    (typeof err?.message === "string" && err.message) ||
    (typeof err?.details === "string" && err.details) ||
    "";
  const code = typeof err?.code === "string" ? err.code : "";

  const lowered = raw.toLowerCase();
  if (raw === "access_denied" || lowered.includes("access_denied") || code === "42501") {
    return "No tienes permisos para ver o gestionar los servicios de este negocio.";
  }
  if (raw === "not_authenticated" || lowered.includes("not_authenticated") || code === "28000") {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.";
  }
  if (raw.trim().length > 0) return raw;
  return "Error al cargar servicios";
}

type ServiciosClientProps = {
  tenantId: string;
  initialServices: Service[];
};

export function ServiciosClient({
  tenantId,
  initialServices,
}: ServiciosClientProps) {
  const supabase = getSupabaseBrowser();
  const didInitialLoad = useRef(false);
  const didInitPriceFilter = useRef(false);
  const [services, setServices] = useState<Service[]>(() =>
    (initialServices || []).map(normalizeService)
  );
  const [form, setForm] = useState<ServiceFormState>(() =>
    buildDefaultFormState()
  );
  const [loading, setLoading] = useState(!initialServices.length);
  const [saving, setSaving] = useState(false);
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
  const priceBounds = useMemo(() => {
    if (!services.length) return { min: 0, max: 0 };
    const values = services.map((service) => service.price_cents / 100);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [services]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 🚀 OPTIMIZACIÓN: Los filtros ahora se pasan directamente a get_services_filtered RPC
  // Ya no necesitamos el objeto filters para filtrado en cliente

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

  useEffect(() => {
    if (didInitPriceFilter.current) return;
    if (!services.length) return;
    // Inicializar el filtro de precio a los límites actuales (sin filtrar).
    setPriceRange([priceBounds.min, priceBounds.max]);
    didInitPriceFilter.current = true;
  }, [services.length, priceBounds.min, priceBounds.max]);

  const loadServices = useCallback(
    async (options?: { showLoader?: boolean; allowEmpty?: boolean }) => {
      if (!tenantId) return;
      if (options?.showLoader) {
        setLoading(true);
      }
      try {
        setPageError(null);

        const [minEuro, maxEuro] = priceRange;
        const minCents = Number.isFinite(minEuro) ? Math.round(Math.max(0, minEuro) * 100) : null;
        const maxCents = Number.isFinite(maxEuro) ? Math.round(Math.max(0, maxEuro) * 100) : null;

        // 🚀 OPTIMIZACIÓN: Usar manage_list_services con filtros del servidor
        const { data, error } = await supabase.rpc('manage_list_services', {
          p_tenant_id: tenantId,
          p_status: filterStatus,
          p_category: filterCategory !== 'all' ? filterCategory : null,
          p_search_term: searchTerm || null,
          p_sort_by: sortBy,
          p_sort_direction: 'asc',
          // Filtros adicionales (precio/buffer)
          p_min_price_cents: minCents != null && maxCents != null && minCents > maxCents ? maxCents : minCents,
          p_max_price_cents: minCents != null && maxCents != null && minCents > maxCents ? minCents : maxCents,
          p_buffer_filter: bufferFilter === "all" ? "all" : bufferFilter,
        });

        if (error) {
          // Propagar el error real para normalizarlo abajo.
          throw error;
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
        setPageError(normalizeServicesPageError(err));
      } finally {
        if (options?.showLoader) {
          setLoading(false);
        }
      }
    },
    [supabase, tenantId, filterStatus, filterCategory, searchTerm, sortBy, bufferFilter, priceRange, services.length]
  );

  // Cargar servicios inicialmente cuando el componente se monta o tenantId cambia
  useEffect(() => {
    if (!tenantId) return;

    // Si ya tenemos datos iniciales, no forzar doble fetch al montar.
    if (initialServices.length > 0) {
      setLoading(false);
      didInitialLoad.current = true;
      return;
    }

    loadServices({ showLoader: true, allowEmpty: true }).finally(() => {
      didInitialLoad.current = true;
    });
  }, [tenantId, initialServices.length, loadServices]);

  // 🔥 Recargar servicios cuando cambien los filtros (debounce para evitar llamadas excesivas)
  useEffect(() => {
    if (!didInitialLoad.current) return;
    const timer = setTimeout(() => {
      if (tenantId) {
        loadServices({ showLoader: false });
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [filterStatus, filterCategory, bufferFilter, searchTerm, sortBy, tenantId, loadServices]);

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
      media_url: form.media_url,
      // vip_tier: form.vip_tier,
      // combo_service_ids: form.combo_service_ids,
      // duration_variants: form.duration_variants
    };

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

  // Nota: la carga inicial se gestiona en el efecto superior (tenantId + initialServices).

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
  const [priceMin, priceMax] = priceRange;
  const hasPriceFilterApplied =
    hasServices &&
    Number.isFinite(priceMin) &&
    Number.isFinite(priceMax) &&
    (Math.round(priceMin * 100) > Math.round(priceBounds.min * 100) ||
      Math.round(priceMax * 100) < Math.round(priceBounds.max * 100));
  const hasFiltersApplied =
    filterStatus !== "all" ||
    filterCategory !== "all" ||
    bufferFilter !== "all" ||
    Boolean(searchTerm) ||
    hasPriceFilterApplied;
  const filteredIsEmpty = hasServices && filteredServices.length === 0;
  // const priceSliderDisabled = false;

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
    if (hasPriceFilterApplied) {
      parts.push(`Precio: ${priceMin.toFixed(2)}€–${priceMax.toFixed(2)}€`);
    }
    return parts.join(" · ");
  }, [filterStatus, filterCategory, bufferFilter, searchTerm, hasPriceFilterApplied, priceMin, priceMax]);

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
    <div className="space-y-5">

      {/* ── Top bar: live stats + CTA ────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-sm text-[var(--text-secondary)]">
          {services.length} servicio{services.length !== 1 ? "s" : ""} · {stats.activeCount} activos · {stats.inactiveCount} archivados
        </p>
        <GlassButton
          onClick={() => openNewModal()}
          className="shrink-0 h-10 px-5"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Nuevo Servicio
        </GlassButton>
      </div>

      {/* ── Quick alert pills ────────────────────────────────────────────── */}
      {quickAlerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickAlerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => handleQuickFilter(alert.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                alert.active
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-amber-500/10 text-amber-400/80 border border-amber-500/20 hover:bg-amber-500/20"
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              {alert.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Search + filters row ─────────────────────────────────────────── */}
      <GlassCard className="p-3">
        <div className="flex flex-col gap-3">
          {/* Row 1: Search + (mobile) filters button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar servicio..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
            />
            {searchInput && (
              <button onClick={() => setSearchInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

            <GlassButton
              className="sm:hidden h-9 px-3"
              variant="secondary"
              onClick={() => setFiltersOpen(true)}
              leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            >
              Filtros
            </GlassButton>
          </div>

          {/* Row 2 (desktop): Status + Sort + Price slider + Clear */}
          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ServiceFilters["status"])}
              className="h-9 rounded-lg bg-white/5 border border-white/10 text-sm text-white px-3 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 rounded-lg bg-white/5 border border-white/10 text-sm text-white px-3 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
              ))}
            </select>

            <div className="min-w-[260px] flex-1">
              <Slider
                value={priceRange}
                onChange={(val) => {
                  if (Array.isArray(val)) setPriceRange(val as [number, number]);
                }}
                min={Math.floor(priceBounds.min)}
                max={Math.ceil(priceBounds.max)}
                step={0.5}
                variant="range"
                showValue={false}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                <span>{priceRange[0].toFixed(2)} €</span>
                <span>{priceRange[1].toFixed(2)} €</span>
              </div>
            </div>

          {hasFiltersApplied && (
            <button
              onClick={clearFilters}
              className="h-9 px-3 rounded-lg text-xs text-[var(--text-secondary)] hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              Limpiar
            </button>
          )}
        </div>
        </div>
      </GlassCard>

      {/* ── Category pills ───────────────────────────────────────────────── */}
      {categoryOptions.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory("all")}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              filterCategory === "all"
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            Todos
          </button>
          {categoryOptions.filter(c => c !== "all").map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(prev => prev === cat ? "all" : cat)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? "bg-[var(--accent-blue)]/20 border border-[var(--accent-blue)]/40 text-[var(--accent-blue)]"
                  : "bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-white hover:bg-white/10"
              }`}
            >
              <Tag className="w-3 h-3" />
              {cat}
            </button>
          ))}
        </div>
      )}

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

      <GlassModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        description="Estado, orden y precio"
        size="md"
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <GlassButton
              variant="ghost"
              onClick={() => {
                clearFilters();
              }}
            >
              Limpiar
            </GlassButton>
            <GlassButton onClick={() => setFiltersOpen(false)}>Aplicar</GlassButton>
          </div>
        }
      >
        <div className="space-y-4 sm:hidden">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Estado</p>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ServiceFilters["status"])}
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 text-sm text-white px-3 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">Orden</p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 text-sm text-white px-3 focus:outline-none focus:border-[var(--accent-blue)]/40 transition-colors"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs text-[var(--text-secondary)] mb-2">Precio</p>
              <Slider
                value={priceRange}
                onChange={(val) => {
                  if (Array.isArray(val)) setPriceRange(val as [number, number]);
                }}
                min={Math.floor(priceBounds.min)}
                max={Math.ceil(priceBounds.max)}
                step={0.5}
                variant="range"
                showValue={false}
              />
              <div className="mt-3 flex items-center justify-between text-sm text-white/80">
                <span>{priceRange[0].toFixed(2)} €</span>
                <span>{priceRange[1].toFixed(2)} €</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Desliza para ajustar el rango de precio.
              </p>
            </div>
          </div>
        </div>
      </GlassModal>

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
                className="grid grid-cols-1 gap-4 transition md:grid-cols-2 xl:grid-cols-3"
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

        {/* ── Staff assignment ─────────────────────────────────────────── */}
        <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
              Personal asignado
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {selectedStaffIds.length === 0
                ? "Sin restricción — cualquier miembro del staff puede realizarlo."
                : `Solo ${selectedStaffIds.length} miembro${selectedStaffIds.length !== 1 ? "s" : ""} puede${selectedStaffIds.length !== 1 ? "n" : ""} realizar este servicio.`}
            </p>
          </div>

          {staffOptionsLoading ? (
            <div className="flex items-center gap-2 py-3 text-[var(--text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando staff…</span>
            </div>
          ) : staffOptions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] italic">
              No hay empleados. Ve a Staff para añadir miembros al equipo.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {staffOptions.map((staff) => {
                const selected = selectedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() =>
                      setSelectedStaffIds((prev) =>
                        selected ? prev.filter((id) => id !== staff.id) : [...prev, staff.id]
                      )
                    }
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 border ${
                      selected
                        ? "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/30 text-white"
                        : "bg-white/3 border-white/8 text-[var(--text-secondary)] hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected ? "bg-[var(--accent-blue)] border-[var(--accent-blue)]" : "border-white/25"
                      }`}
                    >
                      {selected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium truncate">{staff.name}</span>
                  </button>
                );
              })}
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

      <GlassModal
        isOpen={Boolean(servicePendingArchive)}
        onClose={handleCancelArchiveService}
        title="Archivar servicio"
        description="El servicio dejará de estar disponible para clientes, pero se conservará en tu historial."
        footer={
          <div className="flex w-full justify-end gap-2">
            <GlassButton
              variant="ghost"
              onClick={handleCancelArchiveService}
              disabled={Boolean(deletingId)}
            >
              Cancelar
            </GlassButton>
            <GlassButton
              variant="danger"
              onClick={handleConfirmArchiveService}
              isLoading={Boolean(deletingId)}
              disabled={Boolean(deletingId)}
            >
              Archivar
            </GlassButton>
          </div>
        }
      >
        <GlassCard className="p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            ¿Seguro que quieres archivar{" "}
            <span className="font-semibold text-white">
              {servicePendingArchive?.name}
            </span>
            ?
          </p>
        </GlassCard>
      </GlassModal>

      <GlassModal
        isOpen={Boolean(servicePendingHardDelete)}
        onClose={handleCancelHardDeleteService}
        title="Eliminar servicio"
        description="Esta acción es permanente. Si el servicio tiene citas asociadas, puede fallar."
        footer={
          <div className="flex w-full justify-end gap-2">
            <GlassButton
              variant="ghost"
              onClick={handleCancelHardDeleteService}
              disabled={Boolean(deletingId)}
            >
              Cancelar
            </GlassButton>
            <GlassButton
              variant="danger"
              onClick={handleConfirmHardDeleteService}
              isLoading={Boolean(deletingId)}
              disabled={Boolean(deletingId)}
            >
              Eliminar
            </GlassButton>
          </div>
        }
      >
        <GlassCard className="p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            ¿Seguro que quieres eliminar{" "}
            <span className="font-semibold text-white">
              {servicePendingHardDelete?.name}
            </span>
            ?
          </p>
        </GlassCard>
      </GlassModal>

      <ServicePreviewModal
        service={previewService}
        isOpen={Boolean(previewService)}
        onClose={() => setPreviewService(null)}
        onEdit={(service) => {
          setPreviewService(null);
          openEditModal(service);
        }}
        onDuplicate={async (service) => {
          setPreviewService(null);
          await handleDuplicateService(service);
        }}
        onToggleActive={async (id, currentActive) => {
          setPreviewService(null);
          await toggleActive(id, currentActive);
        }}
        onDelete={(service) => {
          setPreviewService(null);
          handleRequestArchiveService(service);
        }}
      />
    </div >
  );
}
