"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { getAgendaRange, type AgendaDataset } from "@/lib/agenda-data";
import type {
  Booking,
  Staff,
  StaffBlocking,
  StaffSchedule,
  ViewMode,
} from "@/types/agenda";
import { guardTenantQuery, logTenantQueryResult } from "@/lib/tenant/validateTenantId";

export interface AgendaStats {
  total_bookings: number;
  total_minutes: number;
  total_amount: number;
}

interface UseAgendaDataOptions {
  tenantId: string | null;
  selectedDate: string;
  viewMode: ViewMode;
  initialData?: AgendaDataset | null;
}

interface UseAgendaDataResult {
  loading: boolean;
  error: string | null;
  staffList: Staff[];
  services: Array<{ id: string; name: string; duration_min: number; price_cents: number; buffer_min: number }>;
  customers: Array<{ id: string; name: string; email: string | null; phone: string | null; notes?: string | null }>;
  bookings: Booking[];
  staffBlockings: StaffBlocking[];
  staffSchedules: StaffSchedule[];
  stats: AgendaStats | null;
  rangeLabel: string;
  refreshDaySnapshots: (targetDate?: string) => Promise<void>;
}

const buildRangeLabel = (currentDate: string, viewMode: ViewMode) => {
  const date = parseISO(currentDate);
  const dayFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" });

  if (viewMode === "week") {
    const weekRange = getAgendaRange(currentDate, "week");
    const start = parseISO(weekRange.startISO);
    const end = parseISO(weekRange.endISO);
    return `${dayFormatter.format(start)} · ${dayFormatter.format(end)}`;
  }

  if (viewMode === "month") {
    return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
  }

  return dayFormatter.format(date);
};

const normalizeStaffList = (
  list?: Array<Pick<Staff, "id" | "name"> & { active?: boolean | null }>
) =>
  (list ?? []).map((member) => ({
    ...member,
    active: Boolean(member.active),
  })) as Staff[];

export function useAgendaData({ tenantId, selectedDate, viewMode, initialData }: UseAgendaDataOptions): UseAgendaDataResult {
  const supabase = getSupabaseBrowser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<Staff[]>(() => normalizeStaffList(initialData?.staff));
  const [services, setServices] = useState(initialData?.services ?? []);
  const [customers, setCustomers] = useState(initialData?.customers ?? []);
  const [bookings, setBookings] = useState<Booking[]>(initialData?.bookings ?? []);
  const [staffBlockings, setStaffBlockings] = useState<StaffBlocking[]>(initialData?.blockings ?? []);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>(initialData?.schedules ?? []);
  const [stats, setStats] = useState<AgendaStats | null>(null);
  const [rangeLabel, setRangeLabel] = useState(() => buildRangeLabel(selectedDate, viewMode));
  const [hydratedTenantId, setHydratedTenantId] = useState(initialData?.tenant.id ?? null);

  useEffect(() => {
    setRangeLabel(buildRangeLabel(selectedDate, viewMode));
  }, [selectedDate, viewMode]);

  useEffect(() => {
    if (!tenantId) {
      setStaffList([]);
      setServices([]);
      setCustomers([]);
      setBookings([]);
      setStaffBlockings([]);
      setStaffSchedules([]);
      setStats(null);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!guardTenantQuery(tenantId, "useAgendaData:loadStaticCatalogs")) return;
    if (hydratedTenantId === tenantId) return;

    let cancelled = false;
    const loadStaticCatalogs = async () => {
      try {
        const [staffRes, servicesRes, customersRes] = await Promise.all([
          supabase
            .from("staff")
            .select("id, name, active")
            .eq("tenant_id", tenantId)
            .eq("active", true)
            .order("name"),
          supabase
            .from("services")
            .select("id, name, duration_min, price_cents, buffer_min")
            .eq("tenant_id", tenantId)
            .eq("active", true)
            .order("name"),
          supabase
            .from("customers")
            .select("id, name, email, phone, notes")
            .eq("tenant_id", tenantId)
            .order("name")
            .limit(100),
        ]);

        if (cancelled) return;

        if (staffRes.error || servicesRes.error || customersRes.error) {
          throw new Error("Error al cargar catálogos");
        }

        setStaffList(normalizeStaffList(staffRes.data));
        setServices((servicesRes.data || []).map((svc) => ({ ...svc, buffer_min: svc.buffer_min ?? 0 })));
        setCustomers(customersRes.data || []);
        setHydratedTenantId(tenantId);
      } catch (err) {
        if (!cancelled) {
          setError("No se pudieron cargar los catálogos");
          console.error(err);
        }
      }
    };

    loadStaticCatalogs();
    return () => {
      cancelled = true;
    };
  }, [tenantId, hydratedTenantId, supabase]);

  // New RPC Data Fetcher
  const fetchWithRpc = async (range: { startISO: string; endISO: string }) => {
    // Call the consolidated RPC
    const { data, error } = await supabase.rpc("get_agenda_v1", {
      p_tenant_id: tenantId,
      p_start_date: range.startISO,
      p_end_date: range.endISO,
    });

    if (error) throw error;

    // The RPC returns a single JSON object. Map it to state.
    // Ensure types match what state expects.
    const rpcData = data as any; // Type assertion since RPC return type is generic JSON

    // 1. Bookings: RPC returns them with nested objects. 
    // We map them to ensure they match 'Booking' interface if needed, 
    // or rely on RPC shape matching.
    setBookings(rpcData.bookings || []);

    // 2. Blockings
    setStaffBlockings(rpcData.blockings || []);

    // 3. Schedules
    setStaffSchedules(rpcData.schedules || []);

    // 4. Stats
    setStats(rpcData.stats || null);

    // Log success
    logTenantQueryResult(rpcData.bookings?.length || 0, "fetchWithRpc:bookings");
  };

  const fetchRangeData = useCallback(
    async (targetDate?: string) => {
      if (!guardTenantQuery(tenantId, "fetchRangeData")) return;
      setLoading(true);
      setError(null);

      const rangeDate = targetDate ?? selectedDate;
      const range = getAgendaRange(rangeDate, viewMode);

      try {
        await fetchWithRpc(range);
      } catch (err) {
        setError("No se pudo cargar la agenda");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [tenantId, selectedDate, viewMode, supabase]
  );

  useEffect(() => {
    fetchRangeData();
  }, [fetchRangeData]);

  const refreshDaySnapshots = useCallback(
    async (targetDate?: string) => {
      await fetchRangeData(targetDate);
    },
    [fetchRangeData]
  );

  return {
    loading,
    error,
    staffList,
    services,
    customers,
    bookings,
    staffBlockings,
    staffSchedules,
    stats,
    rangeLabel,
    refreshDaySnapshots,
  };
}
