"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { format, parseISO, isFuture, isPast } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { GlassCard, GlassButton, GlassSection } from "@/components/ui/glass";
import { Loader2, ArrowLeft, Mail, Phone, Calendar, AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import {
  CustomerBookingsTimeline,
  type CustomerBooking,
} from "@/components/panel/CustomerBookingsTimeline";
import { useCurrentTenantWithImpersonation } from "@/hooks/useCurrentTenantWithImpersonation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { logCustomerAudit } from "@/lib/panel/audit";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
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

function ClienteDetailContent() {
  const supabase = getSupabaseBrowser();
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const {
    tenantId,
    tenantTimezone,
    loadingTenant,
    tenantError,
  } = useCurrentTenantWithImpersonation();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [saving, setSaving] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [potentialDuplicates, setPotentialDuplicates] = useState<Customer[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // Cargar cliente y citas
  useEffect(() => {
    if (!tenantId || !customerId) return;

    const loadData = async () => {
      try {
        setLoading(true);

        // Cargar cliente
        const { data: customerData, error: customerError } = await supabase
          .from("customers")
          .select(
            `
            *,
            tags,
            is_vip,
            is_banned,
            marketing_opt_in
          `
          )
          .eq("tenant_id", tenantId)
          .eq("id", customerId)
          .single();

        if (customerError) throw customerError;
        setCustomer(customerData);

        // Cargar citas
        const { data: bookingsData, error: bookingsError } = await supabase
          .from("bookings")
          .select(`
            *,
            service:services(name, price_cents),
            staff:staff(name)
          `)
          .eq("tenant_id", tenantId)
          .eq("customer_id", customerId)
          .order("starts_at", { ascending: false });

        // Cargar posibles duplicados
        if (customerData) {
          setLoadingDuplicates(true);
          const duplicateConditions: string[] = [];
          if (customerData.email) {
            duplicateConditions.push(`email.eq.${customerData.email}`);
          }
          if (customerData.phone) {
            duplicateConditions.push(`phone.eq.${customerData.phone}`);
          }

          if (duplicateConditions.length > 0) {
            const { data: duplicatesData, error: duplicatesError } = await supabase
              .from("customers")
              .select("id, name, email, phone, visits_count")
              .eq("tenant_id", tenantId)
              .neq("id", customerId)
              .or(duplicateConditions.join(","));

            if (!duplicatesError && duplicatesData) {
              setPotentialDuplicates(duplicatesData as Customer[]);
            }
          }
          setLoadingDuplicates(false);
        }

        if (bookingsError) throw bookingsError;
        setBookings((bookingsData as CustomerBooking[]) || []);
      } catch (err: any) {
        setError(err?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase, tenantId, customerId]);

  // Separar citas próximas y pasadas
  const upcomingBookings = useMemo(() => {
    return bookings.filter((booking) => isFuture(parseISO(booking.starts_at)));
  }, [bookings]);

  const pastBookings = useMemo(() => {
    return bookings.filter((booking) => isPast(parseISO(booking.starts_at)));
  }, [bookings]);

  const bookingMetrics = useMemo(() => {
    const totalBookings = bookings.length;
    const completed = bookings.filter((booking) => booking.status === "completed");
    const noShows = bookings.filter((booking) => booking.status === "no_show");
    const completedBookings = completed.length;
    const noShowBookings = noShows.length;
    const totalAmountCents = completed.reduce(
      (sum, booking) => sum + (booking.service?.price_cents || 0),
      0
    );
    const completedTimestamps = completed.map((booking) =>
      parseISO(booking.starts_at).getTime()
    );
    const noShowTimestamps = noShows.map((booking) =>
      parseISO(booking.starts_at).getTime()
    );
    const firstBookingAt = completedTimestamps.length
      ? new Date(Math.min(...completedTimestamps)).toISOString()
      : null;
    const lastBookingAt = completedTimestamps.length
      ? new Date(Math.max(...completedTimestamps)).toISOString()
      : null;
    const lastNoShowAt = noShowTimestamps.length
      ? new Date(Math.max(...noShowTimestamps)).toISOString()
      : null;

    return {
      totalBookings,
      completedBookings,
      noShowBookings,
      totalAmountCents,
      firstBookingAt,
      lastBookingAt,
      lastNoShowAt,
    };
  }, [bookings]);

  const completedCount = customer?.visits_count ?? bookingMetrics.completedBookings;
  const noShowCount = customer?.no_show_count ?? bookingMetrics.noShowBookings;
  const totalAmountCents =
    customer?.total_spent_cents ?? bookingMetrics.totalAmountCents;
  const lastCompletedAt =
    customer?.last_booking_at ?? bookingMetrics.lastBookingAt;
  const lastNoShowAt =
    customer?.last_no_show_at ?? bookingMetrics.lastNoShowAt;

  const totalSpentFormatted = useMemo(() => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format((totalAmountCents || 0) / 100);
  }, [totalAmountCents]);

  // Calcular ticket medio
  const averageTicket = useMemo(() => {
    const visits = completedCount || 0;
    if (visits === 0) return 0;
    return (totalAmountCents || 0) / visits / 100;
  }, [completedCount, totalAmountCents]);

  const averageTicketFormatted = useMemo(() => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(averageTicket);
  }, [averageTicket]);

  // Clasificación de valor del cliente
  const customerValueTier = useMemo(() => {
    const visits = completedCount || 0;
    const spent = totalAmountCents || 0;

    if (visits >= 5 && spent >= 30000) {
      return { label: "PREMIUM", color: "from-yellow-400 to-amber-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-400/30", textColor: "text-yellow-300" };
    } else if (visits >= 3 && spent < 30000) {
      return { label: "FRECUENTE", color: "from-green-400 to-emerald-500", bgColor: "bg-green-500/10", borderColor: "border-green-400/30", textColor: "text-green-300" };
    } else {
      return { label: "NUEVO / OCASIONAL", color: "from-slate-400 to-slate-500", bgColor: "bg-slate-500/10", borderColor: "border-slate-400/30", textColor: "text-slate-300" };
    }
  }, [completedCount, totalAmountCents]);

  const lastVisit = useMemo(() => {
    if (!pastBookings.length) return null;
    return pastBookings.reduce<CustomerBooking | null>((latest, booking) => {
      if (!latest) return booking;
      return parseISO(booking.starts_at) > parseISO(latest.starts_at) ? booking : latest;
    }, null);
  }, [pastBookings]);

  const lastVisitIso = lastCompletedAt ?? lastVisit?.starts_at ?? null;
  const lastVisitLabel = lastVisitIso
    ? formatInTimeZone(lastVisitIso, tenantTimezone, "dd/MM/yyyy · HH:mm", { locale: es })
    : "Sin visitas";

  const nextVisit = useMemo(() => {
    if (!upcomingBookings.length) return null;
    return upcomingBookings.reduce<CustomerBooking | null>((soonest, booking) => {
      if (!soonest) return booking;
      return parseISO(booking.starts_at) < parseISO(soonest.starts_at) ? booking : soonest;
    }, null);
  }, [upcomingBookings]);

  const customerInitials = useMemo(() => {
    if (!customer?.name) return "CL";
    const parts = customer.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : parts[0]?.[1] ?? "";
    return `${first}${last}`.toUpperCase();
  }, [customer?.name]);

  const avatarColor = useMemo(() => {
    if (!customer?.name) return "var(--gradient-primary-start)";
    let hash = 0;
    for (const char of customer.name) {
      hash = char.charCodeAt(0) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
  }, [customer?.name]);

  const customerSinceYear = useMemo(() => {
    if (!customer?.created_at) return null;
    return format(parseISO(customer.created_at), "yyyy");
  }, [customer?.created_at]);

  const renderAgendaAction = (booking: CustomerBooking) => (
    <Link href={`/panel/agenda?date=${format(parseISO(booking.starts_at), "yyyy-MM-dd")}`}>
      <GlassButton variant="secondary" size="sm">
        Ver en agenda →
      </GlassButton>
    </Link>
  );


  const handleFlagUpdate = async (field: "is_vip" | "is_banned" | "marketing_opt_in", value: boolean) => {
    if (!tenantId || !customer) return;
    try {
      setSaving(true);
      const oldValue = customer[field];

      const { error: updateError } = await supabase
        .from("customers")
        .update({ [field]: value })
        .eq("id", customer.id)
        .eq("tenant_id", tenantId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Registrar auditoría
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logCustomerAudit(
          supabase,
          tenantId,
          user.id,
          "update_flags",
          customer.id,
          { [field]: oldValue },
          { [field]: value },
          { field, source: "customer_detail" }
        );
      }

      setCustomer((prev) => (prev ? { ...prev, [field]: value } : null));
      setSuccessMessage("Estado actualizado correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al actualizar estado");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async () => {
    const tag = newTagValue.trim();
    if (!tenantId || !customer || !tag) return;

    const currentTags = customer.tags ?? [];
    if (currentTags.includes(tag)) {
      setError("Esta etiqueta ya existe");
      return;
    }

    try {
      setSaving(true);
      const nextTags = [...currentTags, tag];
      const { error: updateError } = await supabase
        .from("customers")
        .update({ tags: nextTags })
        .eq("id", customer.id)
        .eq("tenant_id", tenantId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Registrar auditoría
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logCustomerAudit(
          supabase,
          tenantId,
          user.id,
          "update_tags",
          customer.id,
          { tags: currentTags },
          { tags: nextTags },
          { action: "add_tag", tag, source: "customer_detail" }
        );
      }

      setCustomer((prev) => (prev ? { ...prev, tags: nextTags } : null));
      setNewTagValue("");
      setSuccessMessage("Etiqueta añadida correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al añadir etiqueta");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!tenantId || !customer) return;

    const currentTags = customer.tags ?? [];
    const nextTags = currentTags.filter((t) => t !== tagToRemove);

    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from("customers")
        .update({ tags: nextTags })
        .eq("id", customer.id)
        .eq("tenant_id", tenantId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Registrar auditoría
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logCustomerAudit(
          supabase,
          tenantId,
          user.id,
          "update_tags",
          customer.id,
          { tags: currentTags },
          { tags: nextTags },
          { action: "remove_tag", tag: tagToRemove, source: "customer_detail" }
        );
      }

      setCustomer((prev) => (prev ? { ...prev, tags: nextTags } : null));
      setSuccessMessage("Etiqueta eliminada correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Error al eliminar etiqueta");
    } finally {
      setSaving(false);
    }
  };

  if (loadingTenant || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (tenantError && !tenantId) {
    return (
      <GlassCard className="border-red-500/50 bg-red-500/10">
        <div className="text-red-400 p-4">
          <h3 className="mb-2 font-semibold">Error</h3>
          <p className="text-sm">{tenantError}</p>
        </div>
        <div className="p-4 pt-0">
          <Link href="/panel/clientes">
            <GlassButton variant="secondary">
              Volver a Clientes
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    );
  }

  if (error || !customer) {
    return (
      <GlassCard className="border-red-500/50 bg-red-500/10">
        <div className="text-red-400 p-4">
          <h3 className="mb-2 font-semibold">Error</h3>
          <p className="text-sm">{error || "Cliente no encontrado"}</p>
        </div>
        <div className="p-4 pt-0">
          <Link href="/panel/clientes">
            <GlassButton variant="secondary">
              Volver a Clientes
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <Link href="/panel/clientes" className="w-fit">
          <GlassButton variant="ghost" size="sm" className="text-xs sm:text-sm">
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            Volver
          </GlassButton>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full text-base sm:text-lg font-semibold text-white shadow-lg flex-shrink-0"
            style={{ background: avatarColor }}
          >
            {customerInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] font-satoshi break-words">
                {customer.name}
              </h1>
              <span
                className={`rounded-full border ${customerValueTier.borderColor} ${customerValueTier.bgColor} px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${customerValueTier.textColor} flex-shrink-0`}
              >
                {customerValueTier.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5 sm:mt-1">
              {customerSinceYear ? `Cliente desde ${customerSinceYear}` : "Ficha del cliente"}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs de valor del cliente */}
      <GlassCard className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Visitas totales", shortLabel: "Visitas", value: completedCount },
            { label: "Última visita", shortLabel: "Última", value: lastVisitLabel },
            { label: "Importe total", shortLabel: "Total", value: totalSpentFormatted },
            { label: "Ticket medio", shortLabel: "Ticket", value: averageTicketFormatted },
            { label: "No-shows", shortLabel: "No-shows", value: noShowCount },
            { label: "Próxima cita", shortLabel: "Próxima", value: nextVisit ? formatInTimeZone(nextVisit.starts_at, tenantTimezone, "dd/MM/yyyy · HH:mm", { locale: es }) : "Sin cita" },
          ].map((metric) => (
            <div key={metric.label}>
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-[var(--color-text-secondary)] font-satoshi">
                <span className="hidden sm:inline">{metric.label}</span>
                <span className="sm:hidden">{metric.shortLabel}</span>
              </p>
              <p className="mt-1 text-lg sm:text-xl lg:text-2xl font-bold text-[var(--color-text-primary)] font-satoshi break-words">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Mensajes */}
      {successMessage && (
        <GlassCard className="border-emerald-500/50 bg-emerald-500/10 mb-4 p-4">
          <div className="flex justify-between items-start">
            <p className="text-sm text-emerald-400">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-300"><X className="h-4 w-4" /></button>
          </div>
        </GlassCard>
      )}

      {error && (
        <GlassCard className="border-red-500/50 bg-red-500/10 mb-4 p-4">
          <div className="flex justify-between items-start">
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><X className="h-4 w-4" /></button>
          </div>
        </GlassCard>
      )}

      {/* Estado del cliente */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white mb-4 font-satoshi">
          Estado del cliente
        </h2>

        {/* Simple Switch implementation using standard HTML for now or we build GlassSwitch next. 
            For now, I'll use a styled label checkbox as "GlassSwitch" to avoid external deps if possible,
            or just keep it simple. But wait, I need to remove Switch.tsx.
            I will use a simple custom toggle here.
        */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">Cliente VIP</label>
              <p className="text-xs text-[var(--text-secondary)]">Marcar como cliente VIP</p>
            </div>
            <button
              onClick={() => handleFlagUpdate("is_vip", !customer.is_vip)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customer.is_vip ? 'bg-emerald-500' : 'bg-white/10'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.is_vip ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">Cliente baneado</label>
              <p className="text-xs text-[var(--text-secondary)]">Marcar como cliente baneado</p>
            </div>
            <button
              onClick={() => handleFlagUpdate("is_banned", !customer.is_banned)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customer.is_banned ? 'bg-emerald-500' : 'bg-white/10'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.is_banned ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-white">Opt-in marketing</label>
              <p className="text-xs text-[var(--text-secondary)]">Cliente ha aceptado recibir comunicaciones</p>
            </div>
            <button
              onClick={() => handleFlagUpdate("marketing_opt_in", !customer.marketing_opt_in)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customer.marketing_opt_in ? 'bg-emerald-500' : 'bg-white/10'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.marketing_opt_in ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/5">
          <h3 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-3 font-satoshi">
            Etiquetas
          </h3>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
            {(customer.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 sm:px-3 py-1 text-[10px] sm:text-xs uppercase tracking-wide text-[var(--text-secondary)]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={saving}
                  className="ml-0.5 sm:ml-1 hover:text-white transition-colors disabled:opacity-50 p-0.5"
                  aria-label={`Eliminar etiqueta ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Añadir etiqueta..."
              value={newTagValue}
              onChange={(e) => setNewTagValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              disabled={saving}
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all h-11"
            />
            <GlassButton
              onClick={handleAddTag}
              disabled={saving || !newTagValue.trim()}
              size="sm"
              className="w-full sm:w-auto h-11"
            >
              Añadir
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* Posibles duplicados */}
      {potentialDuplicates.length > 0 && (
        <GlassCard className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-white font-satoshi">
              Posibles duplicados
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-3 sm:mb-4">
            Se encontraron {potentialDuplicates.length} cliente{potentialDuplicates.length > 1 ? "s" : ""} con el mismo email o teléfono.
          </p>
          <div className="space-y-2 sm:space-y-3">
            {potentialDuplicates.map((dup) => (
              <div
                key={dup.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border border-amber-500/20 bg-amber-500/5"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base text-white break-words">{dup.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-[var(--text-secondary)]">
                    {dup.email && <span className="break-all">📧 {dup.email}</span>}
                    {dup.phone && <span>📱 {dup.phone}</span>}
                    <span>Visitas: {dup.visits_count || 0}</span>
                  </div>
                </div>
                <Link href={`/panel/clientes/${dup.id}`} className="flex-shrink-0">
                  <GlassButton variant="secondary" size="sm" className="w-full sm:w-auto text-xs sm:text-sm h-9">
                    Ver ficha
                  </GlassButton>
                </Link>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Información del cliente */}
      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white mb-4 font-satoshi">Información</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">{customer.phone}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {customer.birth_date && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Fecha de nacimiento: {format(parseISO(customer.birth_date), "dd/MM/yyyy")}
                </span>
              </div>
            )}
            {customer.created_at && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Fecha de alta: {format(parseISO(customer.created_at), "dd/MM/yyyy")}
                </span>
              </div>
            )}
            {lastNoShowAt && (
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Último no-show: {format(parseISO(lastNoShowAt), "dd/MM/yyyy · HH:mm")}
                </span>
              </div>
            )}
          </div>
        </div>
        {customer.notes && (
          <div className="mt-6 pt-6 border-t border-white/5">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2 font-satoshi">Notas</h3>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </GlassCard>

      {/* Citas */}
      <GlassCard className="p-3 sm:p-4">
        {/* Helper para Tabs usando estado local */}
        <div className="w-full">
          <div className="flex gap-2 mb-4 border-b border-white/5">
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`pb-2 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 ${activeTab === 'upcoming' ? 'border-emerald-500 text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}
            >
              Próximas ({upcomingBookings.length})
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`pb-2 px-1 text-xs sm:text-sm font-medium transition-colors border-b-2 ${activeTab === 'past' ? 'border-emerald-500 text-white' : 'border-transparent text-[var(--text-secondary)] hover:text-white'}`}
            >
              Pasadas ({pastBookings.length})
            </button>
          </div>

          {activeTab === 'upcoming' && (
            <div className="mt-3 sm:mt-4">
              {upcomingBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-white/5 bg-white/[0.02]">
                  <Calendar className="h-10 w-10 text-white/20 mb-3" />
                  <h3 className="text-sm font-medium text-white">No hay citas próximas</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Este cliente no tiene citas programadas</p>
                </div>
              ) : (
                <CustomerBookingsTimeline
                  bookings={upcomingBookings}
                  tenantTimezone={tenantTimezone}
                  renderAction={renderAgendaAction}
                />
              )}
            </div>
          )}

          {activeTab === 'past' && (
            <div className="mt-3 sm:mt-4">
              {pastBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-white/5 bg-white/[0.02]">
                  <Calendar className="h-10 w-10 text-white/20 mb-3" />
                  <h3 className="text-sm font-medium text-white">No hay citas pasadas</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Este cliente aún no tiene historial de citas</p>
                </div>
              ) : (
                <CustomerBookingsTimeline
                  bookings={pastBookings}
                  tenantTimezone={tenantTimezone}
                  renderAction={renderAgendaAction}
                />
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

export default function ClienteDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/20" />
        </div>
      }
    >
      <ClienteDetailContent />
    </Suspense>
  );
}

