"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { fetchTenantStaffOptions } from "@/lib/staff/fetchTenantStaffOptions";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { updateServiceStaff } from "@/lib/staff/staffServicesRelations";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { ServiceCard } from "./components/ServiceCard";
import { ServiceForm } from "./components/ServiceForm";
import { ServicePreviewModal } from "./components/ServicePreviewModal";
import {
  DEFAULT_CATEGORY,
  buildDefaultFormState,
  normalizeService,
  useFilteredServices,
  usePagination,
  useServiceStats,
} from "./hooks";
import type {
  Service,
  ServiceFilters,
  ServiceFormState,
  SortOption,
} from "./types";

const PAGE_SIZE_OPTIONS = [8, 12, 24, 48];

const STATUS_OPTIONS: Array<{ value: ServiceFilters["status"]; label: string }> =
  [
    { value: "all", label: "Todos" },
    { value: "active", label: "Activos" },
    { value: "inactive", label: "Archivados" },
  ];

const STRIPE_OPTIONS: Array<{ value: ServiceFilters["stripe"]; label: string }> =
  [
    { value: "all", label: "Stripe (todos)" },
    { value: "synced", label: "Sincronizados" },
    { value: "pending", label: "Pendientes" },
  ];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "name", label: "Nombre (A-Z)" },
  { value: "duration", label: "Duración asc." },
  { value: "price", label: "Precio asc." },
];

const formatEuros = (value: number) => `${value.toFixed(2)} €`;

type QuickFilterId = "noCategory" | "noStripe" | "noBuffer";

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
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [syncingServiceId, setSyncingServiceId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [servicePendingArchive, setServicePendingArchive] =
    useState<Service | null>(null);
  const [servicePendingHardDelete, setServicePendingHardDelete] =
    useState<Service | null>(null);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  const [filterStatus, setFilterStatus] =
    useState<ServiceFilters["status"]>("active");
  const [filterStripe, setFilterStripe] =
    useState<ServiceFilters["stripe"]>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [bufferFilter, setBufferFilter] =
    useState<ServiceFilters["buffer"]>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filters = useMemo<ServiceFilters>(
    () => ({
      status: filterStatus,
      stripe: filterStripe,
      category: filterCategory,
      priceRange,
      buffer: bufferFilter,
    }),
    [filterStatus, filterStripe, filterCategory, priceRange, bufferFilter]
  );

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
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("name");
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
    [supabase, tenantId, services.length]
  );

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
      // ...existing code...
    };

    try {
      let response: Response;
      if (editingService) {
        response = await fetch(`/api/services/${editingService.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            ...payload,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al guardar servicio");
      }

      // Handle service-staff assignments
      if (editingService) {
        // For existing services, update staff assignments
        await updateServiceStaff(tenantId, editingService.id, selectedStaffIds);
      } else {
        // For new services, assign staff after creation
        await updateServiceStaff(tenantId, data.id, selectedStaffIds);
      }

      // Update lista local sin depender de recarga completa
      if (editingService) {
        setServices((prev) =>
          prev.map((service) =>
            service.id === editingService.id
              ? normalizeService(data as Service)
              : service
          )
        );
      } else {
        setServices((prev) => [
          ...prev,
          normalizeService(data as Service),
        ]);
      }
      closeModal();
      setSuccessMessage(
        editingService
          ? "Servicio actualizado correctamente"
          : "Servicio creado correctamente"
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setModalError(err?.message || "Error al guardar servicio");
    } finally {
      setSaving(false);
    }
  }, [tenantId, form, saving, editingService, loadServices, closeModal]);

  const toggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      setTogglingId(id);
      try {
        const response = await fetch(`/api/services/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !currentActive }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Error al actualizar servicio");
        }
        setServices((prev) =>
          prev.map((service) =>
            service.id === id ? normalizeService(data as Service) : service
          )
        );
        setSuccessMessage(
          `Servicio ${!currentActive ? "activado" : "desactivado"} correctamente`
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setPageError(err?.message || "Error al actualizar servicio");
      } finally {
        setTogglingId(null);
      }
    },
    []
  );

  const handleSyncStripe = useCallback(async () => {
    if (!tenantId || syncingStripe) return;
    setSyncingStripe(true);
    setPageError(null);
    try {
      const response = await fetch("/api/services/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al sincronizar con Stripe");
      }
      const synced = data.syncedCount ?? data.migrated ?? 0;
      await loadServices();
      setSuccessMessage(
        synced === 0
          ? "No había servicios pendientes de Stripe."
          : `Se han sincronizado ${synced} servicio${
              synced === 1 ? "" : "s"
            } con Stripe.`
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setPageError(err?.message || "Error al sincronizar con Stripe");
    } finally {
      setSyncingStripe(false);
    }
  }, [tenantId, syncingStripe, loadServices]);

  const handleSyncService = useCallback(
    async (service: Service) => {
      if (syncingServiceId) return;
      setSyncingServiceId(service.id);
      setPageError(null);
      try {
        const response = await fetch(`/api/services/${service.id}/sync`, {
          method: "POST",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "No se pudo sincronizar con Stripe");
        }
        setServices((prev) =>
          prev.map((item) =>
            item.id === service.id ? normalizeService(data as Service) : item
          )
        );
        setSuccessMessage("Servicio sincronizado con Stripe.");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setPageError(err?.message || "No se pudo sincronizar con Stripe");
      } finally {
        setSyncingServiceId(null);
      }
    },
    [syncingServiceId]
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

    const service = servicePendingArchive;
    setDeletingId(service.id);
    setPageError(null);

    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo archivar el servicio");
      }

      setServices((prev) =>
        prev.map((item) =>
          item.id === service.id ? normalizeService(data as Service) : item
        )
      );

      setPreviewService((prev) =>
        prev && prev.id === service.id
          ? (normalizeService(data as Service) as Service)
          : prev
      );

      setSuccessMessage("Servicio archivado correctamente.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setPageError(err?.message || "No se pudo archivar el servicio");
    } finally {
      setDeletingId(null);
      setServicePendingArchive(null);
    }
  }, [servicePendingArchive]);

  const handleCancelHardDeleteService = useCallback(() => {
    setServicePendingHardDelete(null);
  }, []);

  const handleConfirmHardDeleteService = useCallback(async () => {
    if (!servicePendingHardDelete) return;

    const service = servicePendingHardDelete;
    setDeletingId(service.id);
    setPageError(null);

    try {
      const response = await fetch(`/api/services/${service.id}?hard=true`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo eliminar el servicio de forma definitiva"
        );
      }

      setServices((prev) => prev.filter((item) => item.id !== service.id));
      setPreviewService((prev) =>
        prev && prev.id === service.id ? null : prev
      );

      setSuccessMessage("Servicio eliminado definitivamente.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setPageError(
        err?.message || "No se pudo eliminar el servicio de forma definitiva"
      );
    } finally {
      setDeletingId(null);
      setServicePendingHardDelete(null);
    }
  }, [servicePendingHardDelete]);

  const handleRetry = useCallback(() => {
    // En reintentos, no vaciar la lista actual si la recarga devuelve 0
    // de forma inesperada. Solo aceptar vacío cuando allowEmpty es true.
    loadServices({ showLoader: true, allowEmpty: false });
  }, [loadServices]);

  const clearFilters = useCallback(() => {
    setFilterStatus("all");
    setFilterStripe("all");
    setFilterCategory("all");
    setBufferFilter("all");
    setSortBy("name");
    setSearchInput("");
    setSearchTerm("");
    setPriceRange([priceBounds.min, priceBounds.max]);
  }, [priceBounds.min, priceBounds.max]);

  const stats = useServiceStats(services);

  const filteredServices = useFilteredServices({
    items: services,
    filters,
    searchTerm,
    sortBy,
  });

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
    if (!showModal || !tenantId) return;

    const loadStaffOptions = async () => {
      const options = await fetchTenantStaffOptions(tenantId);
      setStaffOptions(options);
    };

    loadStaffOptions();
  }, [showModal, tenantId]);

  const hasServices = services.length > 0;
  const hasFiltersApplied =
    filterStatus !== "all" ||
    filterStripe !== "all" ||
    filterCategory !== "all" ||
    bufferFilter !== "all" ||
    Boolean(searchTerm) ||
    (services.length > 0 &&
      (priceRange[0] > priceBounds.min || priceRange[1] < priceBounds.max));
  const filteredIsEmpty = hasServices && filteredServices.length === 0;
  const priceSliderDisabled = priceBounds.max <= priceBounds.min;

  const filterSummaryText = useMemo(() => {
    const parts = [
      `Estado: ${
        filterStatus === "all"
          ? "Todos"
          : filterStatus === "active"
          ? "Activos"
          : "Inactivos"
      }`,
      `Stripe: ${
        filterStripe === "all"
          ? "Todos"
          : filterStripe === "synced"
          ? "Sincronizados"
          : "Pendientes"
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
  }, [filterStatus, filterStripe, filterCategory, bufferFilter, searchTerm]);

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
    if (stats.pendingCount > 0) {
      alerts.push({
        id: "noStripe",
        label: `${stats.pendingCount} sin Stripe`,
        count: stats.pendingCount,
        active: filterStripe === "pending",
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
  }, [stats, filterCategory, filterStripe, bufferFilter]);

  const handleQuickFilter = useCallback(
    (id: QuickFilterId) => {
      switch (id) {
        case "noCategory":
          setFilterCategory((prev) =>
            prev === DEFAULT_CATEGORY ? "all" : DEFAULT_CATEGORY
          );
          break;
        case "noStripe":
          setFilterStripe((prev) => (prev === "pending" ? "all" : "pending"));
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
          <Button
            variant="secondary"
            onClick={handleSyncStripe}
            disabled={!tenantId || syncingStripe}
            isLoading={syncingStripe}
            className="w-full sm:w-auto"
          >
            Sincronizar con Stripe
          </Button>
          <Button
            onClick={() => openNewModal()}
            className="w-full sm:w-auto"
          >
            + Nuevo servicio
          </Button>
        </div>
      </div>

      <Card className="rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-white/70">
            Mostrando {filteredServices.length} de {services.length} servicios ·{" "}
            {filterSummaryText}
          </p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Reiniciar filtros
          </Button>
        </div>
      </Card>

      <Card className="rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium text-white">Estado de servicios</p>
          <div className="inline-flex rounded-full bg-white/5 p-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterStatus === option.value
                    ? "bg-white text-black"
                    : "text-white/70 hover:bg-white/10"
                }`}
                aria-pressed={filterStatus === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass">
        <p className="mb-3 text-sm font-medium text-white">
          Filtrar por categoría
        </p>
        <div className="flex flex-wrap gap-2">
          {["all", ...categoryOptions].map((category) => (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                filterCategory === category
                  ? "bg-white text-black"
                  : "bg-white/5 text-white hover:bg-white/10"
              }`}
              aria-pressed={filterCategory === category}
            >
              {category === "all" ? "Todas" : category}
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Rango de precio</p>
              <p className="text-xs text-white/60">
                {formatEuros(priceRange[0])} – {formatEuros(priceRange[1])}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase text-white/60">Mínimo (€)</label>
              <input
                type="number"
                min={priceBounds.min}
                max={priceRange[1]}
                value={priceRange[0]}
                disabled={priceSliderDisabled}
                onChange={(event) =>
                  setPriceRange((prev) => [
                    Math.min(Number(event.target.value), prev[1]),
                    prev[1],
                  ])
                }
                className="rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase text-white/60">Máximo (€)</label>
              <input
                type="number"
                min={priceRange[0]}
                max={priceBounds.max || priceRange[1]}
                value={priceRange[1]}
                disabled={priceSliderDisabled}
                onChange={(event) =>
                  setPriceRange((prev) => [
                    prev[0],
                    Math.max(Number(event.target.value), prev[0]),
                  ])
                }
                className="rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max || priceBounds.min + 1}
              value={priceRange[0]}
              disabled={priceSliderDisabled}
              onChange={(event) =>
                setPriceRange((prev) => [
                  Math.min(Number(event.target.value), prev[1]),
                  prev[1],
                ])
              }
              className="flex-1"
            />
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max || priceBounds.min + 1}
              value={priceRange[1]}
              disabled={priceSliderDisabled}
              onChange={(event) =>
                setPriceRange((prev) => [
                  prev[0],
                  Math.max(Number(event.target.value), prev[0]),
                ])
              }
              className="flex-1"
            />
          </div>
        </div>
      </Card>

      {successMessage && (
        <Card className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
          <p className="text-sm font-medium">{successMessage}</p>
        </Card>
      )}

      {pageError && (
        <Alert type="error" title="Error">
          <div className="flex items-center justify-between gap-4">
            <span>{pageError}</span>
            <Button size="sm" variant="secondary" onClick={handleRetry}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {!hasServices ? (
        <Card>
          <EmptyState
            title="Configura tus servicios base"
            description="Estos servicios se usarán en agenda, pagos y automatizaciones. Crea tus cortes, barbas y tratamientos principales."
            action={
              <Button
                onClick={() =>
                  openNewModal({
                    category: "Corte",
                    duration_min: 30,
                    buffer_min: 5,
                  })
                }
              >
                Crear primer servicio
              </Button>
            }
          />
        </Card>
      ) : filteredIsEmpty ? (
        <Card>
          <EmptyState
            title="Sin resultados con los filtros actuales"
            description="Prueba a ajustar la búsqueda o limpiar filtros para ver más servicios."
            action={
              hasFiltersApplied ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="relative">
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 ${
                gridLoading ? "opacity-60" : "opacity-100"
              } transition`}
            >
              {paginatedItems.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onPreview={setPreviewService}
                  onEdit={openEditModal}
                  onDuplicate={duplicateService}
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
                <Spinner size="sm" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-[14px] border border-white/10 bg-white/5 p-4 shadow-glass md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
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
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingService ? "Editar servicio" : "Nuevo servicio"}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.name.trim()}
              isLoading={saving}
            >
              {editingService ? "Guardar cambios" : "Crear servicio"}
            </Button>
          </div>
        }
      >
        {modalError && (
          <div className="mb-4 rounded-[12px] border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
            {modalError}
          </div>
        )}
        <ServiceForm
          form={form}
          onChange={handleFormChange}
          categoryOptions={categoryOptions}
          staffOptions={staffOptions}
          tenantId={tenantId}
          serviceId={editingService?.id}
          onStaffChange={(staffIds) => {
            setSelectedStaffIds(staffIds);
          }}
        />
        {editingService && (
          <div className="mt-4 rounded-[12px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
            {editingService.stripe_product_id &&
            editingService.stripe_price_id
              ? "Este servicio está conectado a Stripe."
              : "Pendiente de sincronizar con Stripe."}
          </div>
        )}
      </Modal>

      <ServicePreviewModal
        service={previewService}
        isOpen={Boolean(previewService)}
        onClose={() => setPreviewService(null)}
        onEdit={openEditModal}
        onDuplicate={duplicateService}
        onToggleActive={toggleActive}
        onSyncStripe={handleSyncService}
        syncingServiceId={syncingServiceId}
        onDelete={handleRequestArchiveService}
      />

      {servicePendingArchive && (
        <Modal
          isOpen={!!servicePendingArchive}
          onClose={handleCancelArchiveService}
          title="Archivar servicio"
          footer={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleCancelArchiveService}
                disabled={!!deletingId}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmArchiveService}
                isLoading={!!deletingId}
                disabled={!!deletingId}
              >
                Archivar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-white/80">
            Este servicio se marcará como inactivo y pasará a la sección de
            servicios archivados. No se usará en nuevas reservas, pero
            mantendremos su histórico para estadísticas.
          </p>
          <p className="mt-3 text-sm font-medium text-white">
            {servicePendingArchive.name}
          </p>
        </Modal>
      )}
      {servicePendingHardDelete && (
        <Modal
          isOpen={!!servicePendingHardDelete}
          onClose={handleCancelHardDeleteService}
          title="Eliminar servicio definitivamente"
          footer={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleCancelHardDeleteService}
                disabled={!!deletingId}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmHardDeleteService}
                isLoading={!!deletingId}
                disabled={!!deletingId}
              >
                Eliminar definitivamente
              </Button>
            </div>
          }
        >
          <p className="text-sm text-white/80">
            Este servicio se borrará de la base de datos y no será posible
            recuperarlo. Tampoco podremos mantener sus estadísticas históricas,
            lo que puede afectar a métricas como ticket medio o informes
            anteriores.
          </p>
          <p className="mt-3 text-sm font-medium text-white">
            {servicePendingHardDelete.name}
          </p>
        </Modal>
      )}
    </div>
  );
}
