"use client";

import { Fragment, useEffect, useState, Suspense, useMemo, useCallback } from "react";
import { format, parseISO, subDays } from "date-fns";
import Link from "next/link";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { logBulkCustomerAudit, type AuditNewData } from "@/lib/panel/audit";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CustomerBookingsTimeline,
  type CustomerBooking,
} from "@/components/panel/CustomerBookingsTimeline";
import { useCurrentTenantWithImpersonation } from "@/hooks/useCurrentTenantWithImpersonation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import {
  CustomerForm,
  type CustomerFormValues,
} from "@/components/panel/CustomerForm";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  birth_date?: string | null;
  notes?: string | null;
  bookings_count?: number;
  visits_count?: number | null;
  last_booking_at?: string | null;
  total_spent_cents?: number | null;
  no_show_count?: number | null;
  last_no_show_at?: string | null;
  tags?: string[] | null;
  is_vip?: boolean | null;
  is_banned?: boolean | null;
  marketing_opt_in?: boolean | null;
};

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  try {
    return format(parseISO(value), "dd/MM/yyyy · HH:mm");
  } catch {
    return null;
  }
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return null;
  return currencyFormatter.format(value / 100);
};

const ACTIVITY_WINDOW_DAYS = 90;
const TAGS_PREVIEW_LIMIT = 2;

const getActivityThreshold = () => subDays(new Date(), ACTIVITY_WINDOW_DAYS).toISOString();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text: string | null | undefined, rawQuery: string) => {
  if (!text) return text ?? "-";
  const trimmed = rawQuery.trim();
  if (!trimmed) return text;
  const lowerQuery = trimmed.toLowerCase();
  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    part.toLowerCase() === lowerQuery ? (
      <span key={`highlight-${part}-${index}`} className="text-[var(--gradient-primary-start)]">
        {part}
      </span>
    ) : (
      <Fragment key={`text-${part}-${index}`}>{part}</Fragment>
    )
  );
};

const isCustomerWithoutContact = (customer: Customer) => {
  const email = customer.email?.trim();
  const phone = customer.phone?.trim();
  return !email && !phone;
};

function ClientesContent() {
  const supabase = getSupabaseBrowser();
  const {
    tenantId,
    tenantTimezone,
    loadingTenant,
    tenantError,
    impersonateOrgId,
  } = useCurrentTenantWithImpersonation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormValues>({
    name: "",
    email: "",
    phone: "",
    birth_date: "",
    notes: "",
  });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [visitFilter, setVisitFilter] = useState<"all" | "with" | "without">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "active90" | "inactive90">("all");
  const [sortOption, setSortOption] = useState<"recent" | "value">("recent");
  const [segmentFilter, setSegmentFilter] = useState<
    "all" | "vip" | "banned" | "marketing" | "no_contact"
  >("all");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setSelectedCustomerIds((prev) =>
      prev.filter((id) => customers.some((customer) => customer.id === id))
    );
  }, [customers]);

  // Resetear página cuando cambian los filtros server-side
  useEffect(() => {
    setCurrentPage(1);
  }, [activityFilter, segmentFilter, sortOption]);
  
  // Resetear página cuando cambian los filtros client-side
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, visitFilter]);

  const matchesActivityFilter = useCallback(
    (customer: Customer) => {
      if (activityFilter === "active90") {
        return Boolean(
          customer.last_booking_at && customer.last_booking_at >= getActivityThreshold()
        );
      }
      if (activityFilter === "inactive90") {
        return !customer.last_booking_at || customer.last_booking_at < getActivityThreshold();
      }
      return true;
    },
    [activityFilter]
  );

  const matchesSegmentFilter = useCallback(
    (customer: Customer) => {
      switch (segmentFilter) {
        case "vip":
          return Boolean(customer.is_vip);
        case "banned":
          return Boolean(customer.is_banned);
        case "marketing":
          return Boolean(customer.marketing_opt_in);
        case "no_contact":
          return isCustomerWithoutContact(customer);
        default:
          return true;
      }
    },
    [segmentFilter]
  );

  const sortCustomers = useCallback(
    (list: Customer[]) => {
      const sorted = [...list];
      if (sortOption === "value") {
        sorted.sort((a, b) => {
          const aValue = a.total_spent_cents ?? 0;
          const bValue = b.total_spent_cents ?? 0;
          if (bValue !== aValue) return bValue - aValue;
          const aDate = a.last_booking_at ?? a.created_at ?? "";
          const bDate = b.last_booking_at ?? b.created_at ?? "";
          if (aDate && bDate) return bDate.localeCompare(aDate);
          if (aDate) return -1;
          if (bDate) return 1;
          return 0;
        });
      } else {
        sorted.sort((a, b) => {
          const aDate = a.last_booking_at ?? a.created_at ?? "";
          const bDate = b.last_booking_at ?? b.created_at ?? "";
          if (aDate && bDate) return bDate.localeCompare(aDate);
          if (aDate) return -1;
          if (bDate) return 1;
          return 0;
        });
      }
      return sorted;
    },
    [sortOption]
  );

  const normalizeCustomer = useCallback((incoming: any, fallback?: Customer): Customer => {
    const normalizedTags = Array.isArray(incoming?.tags)
      ? incoming.tags
      : fallback?.tags ?? [];

    return {
      ...(fallback ?? {}),
      ...(incoming as Customer),
      bookings_count:
        (incoming?.bookings?.[0]?.count ??
          incoming?.bookings_count ??
          fallback?.bookings_count ??
          0) || 0,
      visits_count: incoming?.visits_count ?? fallback?.visits_count ?? 0,
      last_booking_at: incoming?.last_booking_at ?? fallback?.last_booking_at ?? null,
      total_spent_cents: incoming?.total_spent_cents ?? fallback?.total_spent_cents ?? 0,
      no_show_count: incoming?.no_show_count ?? fallback?.no_show_count ?? 0,
      last_no_show_at: incoming?.last_no_show_at ?? fallback?.last_no_show_at ?? null,
      tags: normalizedTags,
      is_vip: incoming?.is_vip ?? fallback?.is_vip ?? false,
      is_banned: incoming?.is_banned ?? fallback?.is_banned ?? false,
      marketing_opt_in: incoming?.marketing_opt_in ?? fallback?.marketing_opt_in ?? true,
    };
  }, []);

  const highlightMatch = useCallback(
    (value: string | null | undefined) => highlightText(value, debouncedSearch),
    [debouncedSearch]
  );

  useEffect(() => {
    if (!tenantId) return;

    let abort = false;

    const loadCustomers = async () => {
      try {
        setLoading(true);

        let query = supabase
          .from("customers")
          .select(
            `
            id,
            name,
            email,
            phone,
            birth_date,
            notes,
            created_at,
            visits_count,
            last_booking_at,
            total_spent_cents,
            no_show_count,
            last_no_show_at,
            tags,
            is_vip,
            is_banned,
            marketing_opt_in,
            bookings:bookings(count)
          `,
            { count: "exact" }
          )
          .eq("tenant_id", tenantId);

        const activityThreshold = getActivityThreshold();

        if (activityFilter === "active90") {
          query = query.gte("last_booking_at", activityThreshold);
        } else if (activityFilter === "inactive90") {
          query = query.or(`last_booking_at.is.null,last_booking_at.lt.${activityThreshold}`);
        }

        if (segmentFilter === "vip") {
          query = query.eq("is_vip", true);
        } else if (segmentFilter === "banned") {
          query = query.eq("is_banned", true);
        } else if (segmentFilter === "marketing") {
          query = query.eq("marketing_opt_in", true);
        }

        if (sortOption === "value") {
          query = query
            .order("total_spent_cents", { ascending: false, nullsFirst: true })
            .order("last_booking_at", { ascending: false, nullsFirst: false });
        } else {
          query = query
            .order("last_booking_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false });
        }

        // NO aplicar paginación aquí - cargar todos los clientes que pasen los filtros server-side
        // La paginación se aplicará después de los filtros client-side
        const { data: customersData, error: customersError, count } = await query;

        if (customersError) {
          throw new Error(customersError.message);
        }

        if (!abort) {
          const normalized = (customersData || [])
            .map((c: any) => normalizeCustomer(c))
            .filter(matchesActivityFilter)
            .filter(matchesSegmentFilter);
          
          // Guardar todos los clientes filtrados (sin paginación aún)
          const sorted = sortCustomers(normalized);
          console.log("[Clientes] Clientes cargados:", sorted.length);
          setCustomers(sorted);
          
          // Resetear a página 1 cuando se cargan nuevos datos
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (!abort) {
          setError(err?.message || "Error al cargar clientes");
        }
      } finally {
        if (!abort) {
          setLoading(false);
        }
      }
    };

    const handleRealtimeChange = (payload: any) => {
      if (!payload?.eventType) {
        loadCustomers();
        return;
      }

      if (payload.eventType === "INSERT" && payload.new) {
        setCustomers((prev) => {
          const nextCustomer = normalizeCustomer(payload.new);
          if (
            !matchesActivityFilter(nextCustomer) ||
            !matchesSegmentFilter(nextCustomer)
          ) {
            return prev;
          }
          const filtered = prev.filter((customer) => customer.id !== nextCustomer.id);
          return sortCustomers([nextCustomer, ...filtered]);
        });
        return;
      }

      if (payload.eventType === "UPDATE" && payload.new) {
        setCustomers((prev) => {
          const nextCustomer = normalizeCustomer(
            payload.new,
            prev.find((customer) => customer.id === payload.new.id)
          );
          const matches =
            matchesActivityFilter(nextCustomer) && matchesSegmentFilter(nextCustomer);

          if (!matches) {
            return prev.filter((customer) => customer.id !== nextCustomer.id);
          }

          const exists = prev.some((customer) => customer.id === nextCustomer.id);
          const updated = exists
            ? prev.map((customer) =>
                customer.id === nextCustomer.id ? nextCustomer : customer
              )
            : [nextCustomer, ...prev];

          return sortCustomers(updated);
        });
        return;
      }

      if (payload.eventType === "DELETE" && payload.old) {
        setCustomers((prev) => prev.filter((customer) => customer.id !== payload.old.id));
        return;
      }

      loadCustomers();
    };

    loadCustomers();

    const channel = supabase
      .channel("rt-customers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `tenant_id=eq.${tenantId}`,
        },
        handleRealtimeChange
      )
      .subscribe();

    return () => {
      abort = true;
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
    tenantId,
    activityFilter,
    sortOption,
    segmentFilter,
    matchesActivityFilter,
    matchesSegmentFilter,
    normalizeCustomer,
    sortCustomers,
  ]);

  const openNewModal = () => {
    setEditingCustomer(null);
    setForm({ name: "", email: "", phone: "", birth_date: "", notes: "" });
    setError(null);
    setEmailError(null);
    setShowModal(true);
  };

  const getVisitBadge = (bookingsCount?: number | null) => {
    const count = bookingsCount || 0;
    if (count === 0) return "Nuevo";
    if (count >= 3) return "Recurrente";
    return null;
  };

  // Detectar posibles duplicados usando un mapa eficiente
  const duplicateMap = useMemo(() => {
    const emailMap = new Map<string, string[]>();
    const phoneMap = new Map<string, string[]>();

    customers.forEach((customer) => {
      if (customer.email) {
        const emailKey = customer.email.toLowerCase().trim();
        if (!emailMap.has(emailKey)) {
          emailMap.set(emailKey, []);
        }
        emailMap.get(emailKey)!.push(customer.id);
      }
      if (customer.phone) {
        const phoneKey = customer.phone.trim();
        if (!phoneMap.has(phoneKey)) {
          phoneMap.set(phoneKey, []);
        }
        phoneMap.get(phoneKey)!.push(customer.id);
      }
    });

    const duplicateIds = new Set<string>();
    emailMap.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach((id) => duplicateIds.add(id));
      }
    });
    phoneMap.forEach((ids) => {
      if (ids.length > 1) {
        ids.forEach((id) => duplicateIds.add(id));
      }
    });

    return duplicateIds;
  }, [customers]);

  const isPossibleDuplicate = useCallback(
    (customerId: string): boolean => {
      return duplicateMap.has(customerId);
    },
    [duplicateMap]
  );

  const renderStatusBadges = (customer: Customer) => {
    const badges: React.ReactElement[] = [];
    if (customer.is_vip) {
      badges.push(
        <span
          key="vip"
          className="rounded-full border border-[var(--gradient-primary-start)]/30 bg-[var(--gradient-primary-start)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--gradient-primary-start)]"
        >
          VIP
        </span>
      );
    }
    if (customer.is_banned) {
      badges.push(
        <span
          key="banned"
          className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300"
        >
          Baneado
        </span>
      );
    }
    if (!badges.length) return null;
    return <div className="mt-1 flex flex-wrap gap-2">{badges}</div>;
  };

  const renderDuplicateBadge = (customerId: string) => {
    if (!isPossibleDuplicate(customerId)) return null;
    return (
      <span
        className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
        title="Comparte email/teléfono con otro cliente. Revisa antes de usar para campañas."
      >
        <AlertTriangleIcon className="h-3 w-3" />
        Duplicado posible
      </span>
    );
  };

  const renderTagChips = (tags: string[] = []) => {
    if (!tags.length) {
      return (
        <span className="text-xs text-[var(--color-text-disabled)]">
          Sin etiquetas
        </span>
      );
    }
    const visible = tags.slice(0, TAGS_PREVIEW_LIMIT);
    const extra = tags.length - visible.length;
    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]"
          >
            {tag}
          </span>
        ))}
        {extra > 0 && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
            +{extra}
          </span>
        )}
      </div>
    );
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      birth_date: (customer as any).birth_date || "",
      notes: (customer as any).notes || "",
    });
    setError(null);
    setEmailError(null);
    setShowModal(true);
  };

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError(null);
      return true;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Email no válido");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setForm({ name: "", email: "", phone: "", birth_date: "", notes: "" });
    setError(null);
    setEmailError(null);
  };

  const handleSubmit = async () => {
    if (!tenantId || !form.name.trim() || saving) return;

    // Validar email
    if (form.email && !validateEmail(form.email)) {
      setSaving(false);
      return;
    }

    setError(null);
    setEmailError(null);
    setSaving(true);

    try {
      if (editingCustomer) {
        // Actualizar
        const { data, error: updateError } = await supabase
          .from("customers")
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            birth_date: form.birth_date || null,
            notes: form.notes.trim() || null,
          })
          .eq("id", editingCustomer.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        const normalized = normalizeCustomer(data, editingCustomer);
        setCustomers((prev) =>
          sortCustomers(
            prev.map((customer) => (customer.id === editingCustomer.id ? normalized : customer))
          )
        );
        setSuccessMessage("Cliente actualizado correctamente");
      } else {
        // Crear
        const { data, error: createError } = await supabase
          .from("customers")
          .insert({
            tenant_id: tenantId,
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            birth_date: form.birth_date || null,
            notes: form.notes.trim() || null,
          })
          .select()
          .single();

        if (createError) {
          throw new Error(createError.message);
        }

        const normalized = normalizeCustomer(data);
        setCustomers((prev) => sortCustomers([normalized, ...prev]));
        setSuccessMessage("Cliente creado correctamente");
      }

      closeModal();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  };

  const customerStats = useMemo(() => {
    // Stats globales (para el header)
    return {
      total: totalCount || customers.length,
      withBookings: customers.filter((customer) => (customer.bookings_count || 0) > 0).length,
      withoutContact: customers.filter(isCustomerWithoutContact).length,
    };
  }, [customers, totalCount]);

  const searchQuery = debouncedSearch.trim().toLowerCase();

  // Aplicar todos los filtros client-side
  const allFilteredCustomers = useMemo(() => {
    // Nota: los filtros de actividad y segmento (excepto "sin contacto") se aplican server-side.
    // Aquí solo combinamos la búsqueda local, el filtro por visitas y el caso "sin contacto".
    const filtered = customers
      .filter((customer) => {
        if (!searchQuery) return true;
        const emailValue = customer.email?.toLowerCase() ?? "";
        const phoneValue = customer.phone?.toLowerCase() ?? "";
        return (
          customer.name.toLowerCase().includes(searchQuery) ||
          emailValue.includes(searchQuery) ||
          phoneValue.includes(searchQuery)
        );
      })
      .filter((customer) => {
        if (visitFilter === "with") return (customer.bookings_count || 0) > 0;
        if (visitFilter === "without") return (customer.bookings_count || 0) === 0;
        return true;
      })
      .filter((customer) => {
        if (segmentFilter === "no_contact") {
          return isCustomerWithoutContact(customer);
        }
        return true;
      });
    console.log("[Clientes] Filtrados client-side:", filtered.length, "de", customers.length);
    return filtered;
  }, [customers, searchQuery, visitFilter, segmentFilter]);

  // Aplicar paginación sobre los clientes filtrados
  const filteredCustomers = useMemo(() => {
    if (allFilteredCustomers.length === 0) return [];
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    const paginated = allFilteredCustomers.slice(from, to);
    console.log("[Clientes] Paginados:", paginated.length, "página", currentPage, "de", Math.ceil(allFilteredCustomers.length / PAGE_SIZE));
    return paginated;
  }, [allFilteredCustomers, currentPage]);

  // Actualizar totalCount cuando cambien los filtros client-side
  useEffect(() => {
    const total = allFilteredCustomers.length;
    setTotalCount(total);
    // Resetear a página 1 si la página actual está fuera de rango
    const maxPage = Math.ceil(total / PAGE_SIZE) || 1;
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(1);
    }
  }, [allFilteredCustomers.length, currentPage]);

  // KPIs sobre clientes filtrados (todos, no solo página actual)
  const filteredStats = useMemo(() => {
    const total = allFilteredCustomers.length;
    const vip = allFilteredCustomers.filter((c) => c.is_vip).length;
    const banned = allFilteredCustomers.filter((c) => c.is_banned).length;
    const marketing = allFilteredCustomers.filter((c) => c.marketing_opt_in).length;
    const withBookings = allFilteredCustomers.filter((c) => (c.bookings_count || 0) > 0).length;
    const withoutContact = allFilteredCustomers.filter(isCustomerWithoutContact).length;

    return {
      total,
      vip,
      banned,
      marketing,
      withBookings,
      withoutContact,
    };
  }, [allFilteredCustomers]);

  if (loadingTenant) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const showSkeleton = loading;
  const selectionCount = selectedCustomerIds.length;
  const selectionActive = selectionCount > 0;
  const visibleIds = filteredCustomers.map((customer) => customer.id);
  const allVisibleSelected =
    selectionActive &&
    filteredCustomers.length > 0 &&
    filteredCustomers.every((customer) => selectedCustomerIds.includes(customer.id));

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  };

  const toggleSelectAllVisible = () => {
    if (!filteredCustomers.length) return;
    if (allVisibleSelected) {
      setSelectedCustomerIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedCustomerIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const clearSelection = () => setSelectedCustomerIds([]);

  const handleExportCsv = () => {
    if (!tenantId) return;
    const params = new URLSearchParams({
      activity: activityFilter,
      segment: segmentFilter,
      order: sortOption,
      visitFilter,
    });
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }
    if (impersonateOrgId) {
      params.set("impersonate", impersonateOrgId);
    }
    const url = `/api/panel/customers/export?${params.toString()}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleBulkFlagUpdate = async (updates: Partial<Customer>) => {
    if (!tenantId || !selectionCount) return;
    try {
      setBulkActionLoading(true);
      
      // Obtener valores anteriores para auditoría
      const affectedCustomers = customers.filter((c) => selectedCustomerIds.includes(c.id));
      const oldValues = affectedCustomers.reduce((acc, c) => {
        acc[c.id] = {
          is_vip: c.is_vip,
          is_banned: c.is_banned,
          marketing_opt_in: c.marketing_opt_in,
        };
        return acc;
      }, {} as Record<string, any>);

      const { error: updateError } = await supabase
        .from("customers")
        .update(updates)
        .in("id", selectedCustomerIds)
        .eq("tenant_id", tenantId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Registrar auditoría para cada cliente
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logBulkCustomerAudit(
          supabase,
          tenantId,
          user.id,
          "bulk_update_flags",
          selectedCustomerIds,
          oldValues,
          updates as AuditNewData,
          { source: "customer_list", count: selectedCustomerIds.length }
        );
      }

      setSuccessMessage("Clientes actualizados correctamente");
      clearSelection();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "No se pudieron aplicar los cambios masivos");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkTagSubmit = async () => {
    const tag = bulkTagValue.trim();
    if (!tenantId || !selectionCount || !tag) return;
    try {
      setBulkActionLoading(true);
      await Promise.all(
        selectedCustomerIds.map(async (id) => {
          const customer = customers.find((c) => c.id === id);
          const currentTags = customer?.tags ?? [];
          if (currentTags.includes(tag)) return;
          const nextTags = [...currentTags, tag];
          const { error: tagError } = await supabase
            .from("customers")
            .update({ tags: nextTags })
            .eq("tenant_id", tenantId)
            .eq("id", id);
          if (tagError) {
            throw new Error(tagError.message);
          }

          // Registrar auditoría
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await logBulkCustomerAudit(
              supabase,
              tenantId,
              user.id,
              "bulk_update_tags",
              [id],
              { [id]: { tags: currentTags } },
              { tags: nextTags },
              { action: "add_tag", tag, source: "customer_list_bulk", count: selectedCustomerIds.length }
            );
          }
        })
      );
      setSuccessMessage("Etiqueta añadida correctamente");
      clearSelection();
      setShowTagModal(false);
      setBulkTagValue("");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "No se pudo añadir la etiqueta");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const closeTagModal = () => {
    setShowTagModal(false);
    setBulkTagValue("");
  };

  const canRunBulkActions = selectionActive && !bulkActionLoading;

  if ((tenantError && !tenantId) || (error && !tenantId)) {
    return (
      <Alert type="error" title="Error">
        {tenantError || error}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} ${customers.length === 1 ? "cliente" : "clientes"}`}
        description="Gestiona tu base de clientes, filtra y busca fácilmente, y accede a sus historiales de reservas."
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={handleExportCsv}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Exportar CSV
            </Button>
            <Button
              onClick={openNewModal}
              className="w-full sm:w-auto"
            >
              + Nuevo Cliente
            </Button>
          </div>
        }
      />
        
        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
          style={{ borderRadius: "var(--radius-md)" }}
        />
        
        {/* Filtros */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] sm:text-xs font-medium text-[var(--color-text-secondary)]">
              Visitas
            </label>
            <select
              value={visitFilter}
              onChange={(e) => setVisitFilter(e.target.value as typeof visitFilter)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="all">Todas</option>
              <option value="with">Con reservas</option>
              <option value="without">Sin reservas</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] sm:text-xs font-medium text-[var(--color-text-secondary)]">
              Actividad
            </label>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as typeof activityFilter)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="all">Todas</option>
              <option value="active90">Activas 90d</option>
              <option value="inactive90">Inactivas +90d</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] sm:text-xs font-medium text-[var(--color-text-secondary)]">
              Segmento
            </label>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value as typeof segmentFilter)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="all">Todos</option>
              <option value="vip">VIP</option>
              <option value="banned">Baneados</option>
              <option value="marketing">Marketing</option>
              <option value="no_contact">Sin contacto</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
            <label className="text-[10px] sm:text-xs font-medium text-[var(--color-text-secondary)]">
              Ordenar
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <option value="recent">Recientes</option>
              <option value="value">Mayor gasto</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* KPIs globales */}
        {[
          { label: "Total", value: customerStats.total, shortLabel: "Total" },
          { label: "Con reservas", value: customerStats.withBookings, shortLabel: "Reservas" },
          { label: "Sin contacto", value: customerStats.withoutContact, shortLabel: "Sin contacto" },
        ].map((item) => (
          <Card key={item.label} className="p-2.5 sm:p-3" padding="none">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.shortLabel}</span>
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] font-satoshi">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      {(filteredStats.total !== customerStats.total || 
        searchQuery || 
        visitFilter !== "all" || 
        activityFilter !== "all" || 
        segmentFilter !== "all") && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {/* KPIs sobre clientes filtrados */}
          {[
            { label: "Visibles", value: filteredStats.total, shortLabel: "Visibles" },
            { label: "VIP", value: filteredStats.vip, shortLabel: "VIP" },
            { label: "Baneados", value: filteredStats.banned, shortLabel: "Baneados" },
            { label: "Marketing", value: filteredStats.marketing, shortLabel: "Marketing" },
            { label: "Con reservas", value: filteredStats.withBookings, shortLabel: "Reservas" },
            { label: "Sin contacto", value: filteredStats.withoutContact, shortLabel: "Sin contacto" },
          ].map((item) => (
            <Card key={item.label} className="p-2" padding="none">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                {item.shortLabel}
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-bold text-[var(--color-text-primary)] font-satoshi">
                {item.value}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Mensajes */}
      {successMessage && (
        <Alert type="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert type="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {selectionActive && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-medium">
              {selectionCount} {selectionCount === 1 ? "cliente seleccionado" : "clientes seleccionados"}
            </p>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTagModal(true)}
                disabled={!canRunBulkActions}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Añadir etiqueta
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkFlagUpdate({ is_vip: true })}
                disabled={!canRunBulkActions}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Marcar VIP
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkFlagUpdate({ is_banned: true })}
                disabled={!canRunBulkActions}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Marcar baneados
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearSelection}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      {showSkeleton ? (
        <div className="space-y-3">
          <div className="hidden md:block rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[rgba(20,25,45,0.65)] p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-row-${index}`} className="mb-3 h-8 w-full animate-pulse rounded-[var(--radius-md)] bg-white/5 last:mb-0" />
            ))}
          </div>
          <div className="md:hidden space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`skeleton-card-${index}`} className="h-24 animate-pulse rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[rgba(20,25,45,0.65)]" />
            ))}
          </div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={
            allFilteredCustomers.length === 0 && customers.length === 0
              ? "Todavía no tienes clientes"
              : allFilteredCustomers.length === 0 && customers.length > 0
              ? "No hay clientes que cumplan los filtros"
              : "No hay clientes en esta página"
          }
          description={
            allFilteredCustomers.length === 0 && customers.length === 0
              ? "Crea el primero desde el botón 'Nuevo cliente'."
              : allFilteredCustomers.length === 0 && customers.length > 0
              ? "Prueba a limpiar la búsqueda o cambiar los filtros."
              : `Hay ${allFilteredCustomers.length} cliente${allFilteredCustomers.length === 1 ? "" : "s"} que cumplen los filtros. Intenta cambiar de página.`
          }
        />
      ) : (
        <>
          {/* Vista Desktop/Tablet: Tabla integrada sin caja */}
          <div className="hidden lg:block overflow-x-auto rounded-[var(--radius-lg)] overflow-hidden" style={{
            background: "linear-gradient(135deg, rgba(123, 92, 255, 0.03) 0%, rgba(77, 226, 195, 0.02) 100%)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
          }}>
              <table className="w-full min-w-[800px]">
                <thead className="border-b border-[var(--glass-border)]">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 w-10 sm:w-12">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        className="h-4 w-4 sm:h-5 sm:w-5 rounded border-slate-600 bg-transparent text-[var(--gradient-primary-start)] focus:ring-2 focus:ring-[var(--gradient-primary-start)]/40 cursor-pointer"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                      />
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-satoshi">
                      Nombre
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-satoshi hidden xl:table-cell">
                      Email
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-satoshi hidden xl:table-cell">
                      Teléfono
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-satoshi">
                      Reservas
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-satoshi hidden 2xl:table-cell">
                      Etiquetas
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider font-satoshi">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredCustomers.map((customer, index) => {
                    const visitBadge = getVisitBadge(customer.bookings_count);
                    const lastVisitLabel = formatDateTime(customer.last_booking_at);
                    const totalSpentLabel = formatCurrency(customer.total_spent_cents);
                    const isSelected = selectedCustomerIds.includes(customer.id);
                    const statusBadges = renderStatusBadges(customer);
                    const duplicateBadge = renderDuplicateBadge(customer.id);
                    return (
                      <tr
                        key={customer.id}
                        className={cn(
                          "transition-all duration-150",
                          index % 2 === 0 ? "bg-slate-800/20" : "bg-slate-800/10",
                          "hover:bg-slate-700/30 hover:shadow-sm",
                          isSelected && "ring-1 ring-[var(--gradient-primary-start)]/40"
                        )}
                      >
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${customer.name}`}
                            className="h-4 w-4 sm:h-5 sm:w-5 rounded border-slate-600 bg-transparent text-[var(--gradient-primary-start)] focus:ring-2 focus:ring-[var(--gradient-primary-start)]/40 cursor-pointer"
                            checked={isSelected}
                            onChange={() => toggleCustomerSelection(customer.id)}
                          />
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 min-w-[150px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/panel/clientes/${customer.id}`}
                              className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] hover:text-[var(--gradient-primary-start)] transition-smooth font-satoshi"
                            >
                              {highlightMatch(customer.name)}
                            </Link>
                            {duplicateBadge}
                          </div>
                          {statusBadges}
                          {(lastVisitLabel || totalSpentLabel) && (
                            <div className="mt-1 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-[var(--color-text-secondary)]">
                              {lastVisitLabel && <span className="truncate">Última · {lastVisitLabel}</span>}
                              {totalSpentLabel && <span className="truncate">Valor · {totalSpentLabel}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 hidden xl:table-cell">
                          <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] truncate max-w-[200px]">
                            {customer.email ? highlightMatch(customer.email) : "-"}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 hidden xl:table-cell">
                          <div className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                            {customer.phone ? highlightMatch(customer.phone) : "-"}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--color-text-secondary)]">
                            {customer.bookings_count || 0}
                            {visitBadge && (
                              <span className="rounded-full border border-white/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] uppercase tracking-wide text-[var(--color-text-primary)] bg-white/5">
                                {visitBadge}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 hidden 2xl:table-cell">{renderTagChips(customer.tags ?? [])}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowHistory(customer.id)}
                              className="text-xs sm:text-sm px-2 sm:px-3"
                            >
                              Historial
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(customer)}
                              className="text-xs sm:text-sm px-2 sm:px-3"
                            >
                              Editar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer) => {
              const visitBadge = getVisitBadge(customer.bookings_count);
              const lastVisitLabel = formatDateTime(customer.last_booking_at);
              const totalSpentLabel = formatCurrency(customer.total_spent_cents);
              const isSelected = selectedCustomerIds.includes(customer.id);
              const statusBadges = renderStatusBadges(customer);
              const duplicateBadge = renderDuplicateBadge(customer.id);
              return (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 sm:p-4 rounded-[var(--radius-lg)] active:scale-[0.98] transition-all duration-200",
                    "border border-[var(--glass-border)] bg-[rgba(20,25,45,0.85)]",
                    isSelected && "ring-2 ring-[var(--gradient-primary-start)]/40"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${customer.name}`}
                          className="mt-1 h-5 w-5 sm:h-6 sm:w-6 rounded border-slate-600 bg-transparent text-[var(--gradient-primary-start)] focus:ring-2 focus:ring-[var(--gradient-primary-start)]/40 cursor-pointer flex-shrink-0"
                          checked={isSelected}
                          onChange={() => toggleCustomerSelection(customer.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Link
                              href={`/panel/clientes/${customer.id}`}
                              className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] hover:text-[var(--gradient-primary-start)] transition-colors duration-200 font-satoshi break-words"
                            >
                              {highlightMatch(customer.name)}
                            </Link>
                            {duplicateBadge}
                          </div>
                          {statusBadges}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-2 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowHistory(customer.id)}
                          className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                        >
                          Historial
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openEditModal(customer)}
                          className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-sm sm:text-base text-[var(--color-text-secondary)]">
                      {customer.email && (
                        <div className="flex items-start gap-2">
                          <span className="text-[var(--color-text-disabled)] text-xs sm:text-sm flex-shrink-0">📧</span>
                          <span className="text-[var(--color-text-primary)] break-all">
                            {highlightMatch(customer.email)}
                          </span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-start gap-2">
                          <span className="text-[var(--color-text-disabled)] text-xs sm:text-sm flex-shrink-0">📱</span>
                          <span className="text-[var(--color-text-primary)] break-all">
                            {highlightMatch(customer.phone)}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[var(--color-text-disabled)] text-xs sm:text-sm">Reservas:</span>
                        <span className="text-[var(--color-text-primary)] font-semibold text-sm sm:text-base">
                          {customer.bookings_count || 0}
                        </span>
                        {visitBadge && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] sm:text-xs uppercase tracking-wide text-[var(--color-text-primary)] bg-white/5">
                            {visitBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    {(lastVisitLabel || totalSpentLabel) && (
                      <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-[var(--color-text-secondary)] pt-1 border-t border-[var(--glass-border)]">
                        {lastVisitLabel && <span className="truncate">Última visita · {lastVisitLabel}</span>}
                        {totalSpentLabel && <span className="truncate">Valor · {totalSpentLabel}</span>}
                      </div>
                    )}
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="pt-2 border-t border-[var(--glass-border)]">
                        {renderTagChips(customer.tags)}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Controles de paginación */}
      {filteredCustomers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 pt-4 border-t border-[var(--glass-border)]">
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] text-center sm:text-left">
            Mostrando <span className="font-medium text-[var(--color-text-primary)]">{((currentPage - 1) * PAGE_SIZE) + 1}</span> - <span className="font-medium text-[var(--color-text-primary)]">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> de <span className="font-medium text-[var(--color-text-primary)]">{totalCount}</span> clientes
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="flex-1 sm:flex-initial text-xs sm:text-sm px-3 sm:px-4 py-2"
            >
              ← Anterior
            </Button>
            <span className="text-xs sm:text-sm text-[var(--color-text-secondary)] px-2 sm:px-3 font-medium">
              {currentPage} / {totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 1}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage * PAGE_SIZE >= totalCount || loading}
              className="flex-1 sm:flex-initial text-xs sm:text-sm px-3 sm:px-4 py-2"
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}

      {/* Modal de crear/editar */}
      <>
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
          footer={
            <>
              <Button variant="secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !form.name.trim()}
                isLoading={saving}
              >
                {editingCustomer ? "Guardar" : "Crear"}
              </Button>
            </>
          }
        >
          <CustomerForm
            form={form}
            setForm={setForm}
            emailError={emailError}
            onEmailValidate={validateEmail}
            error={error}
          />
        </Modal>
        <Modal
          isOpen={showTagModal}
          onClose={closeTagModal}
          title="Añadir etiqueta"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={closeTagModal} disabled={bulkActionLoading}>
                Cancelar
              </Button>
              <Button
                onClick={handleBulkTagSubmit}
                disabled={!bulkTagValue.trim()}
                isLoading={bulkActionLoading}
              >
                Aplicar
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--color-text-secondary)]">
            Se añadirá a {selectionCount || 0} {selectionCount === 1 ? "cliente" : "clientes"}.
          </p>
          <input
            type="text"
            value={bulkTagValue}
            onChange={(e) => setBulkTagValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBulkTagSubmit();
              }
            }}
            className="mt-3 w-full rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[rgba(15,23,42,0.65)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--gradient-primary-start)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
            placeholder="Ej. VIP, Newsletter..."
          />
        </Modal>
        {/* Modal de historial */}
        {showHistory && (
          <Modal
            isOpen={!!showHistory}
            onClose={() => setShowHistory(null)}
            title="Historial del Cliente"
            size="lg"
          >
            <CustomerHistory
              customerId={showHistory}
              tenantId={tenantId!}
              tenantTimezone={tenantTimezone}
            />
          </Modal>
        )}
      </>
    </div>
  );
}

// Componente de historial
function CustomerHistory({
  customerId,
  tenantId,
  tenantTimezone,
}: {
  customerId: string;
  tenantId: string | null;
  tenantTimezone: string;
}) {
  const supabase = getSupabaseBrowser();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !customerId) return;

    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select(
            `
            *,
            service:services(name, price_cents),
            staff:staff(name)
          `
          )
          .eq("tenant_id", tenantId)
          .eq("customer_id", customerId)
          .order("starts_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setBookings((data as CustomerBooking[]) || []);
      } catch (err) {
        console.error("Error al cargar historial:", err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [supabase, tenantId, customerId]);

  if (loading) {
    return <Spinner size="md" />;
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No hay historial"
        description="Este cliente aún no tiene reservas"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* TODO: soportar paginación para más de 20 citas */}
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
        Mostrando las 20 últimas citas
      </p>
      <CustomerBookingsTimeline bookings={bookings} tenantTimezone={tenantTimezone} />
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <ClientesContent />
    </Suspense>
  );
}
