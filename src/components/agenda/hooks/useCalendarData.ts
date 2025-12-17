"use client";

import { useState, useEffect, useMemo } from "react";
import { Booking, Staff, StaffBlocking, StaffSchedule } from "@/types/agenda";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

interface UseCalendarDataProps {
  tenantId?: string;
  selectedDate: string;
  staffList: Staff[];
}

interface CalendarData {
  bookings: Booking[];
  staffBlockings: StaffBlocking[];
  staffSchedules: StaffSchedule[];
  bookingsByStaff: Map<string, Booking[]>;
  blockingsByStaff: Map<string, StaffBlocking[]>;
  loading: boolean;
  error: string | null;
  refreshData: (targetDate?: string) => Promise<void>;
}

export function useCalendarData({
  tenantId,
  selectedDate,
  staffList,
}: UseCalendarDataProps): CalendarData {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffBlockings, setStaffBlockings] = useState<StaffBlocking[]>([]);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();

  // Load data when date or tenant changes
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const start = new Date(`${selectedDate}T00:00:00`);
        const end = new Date(`${selectedDate}T23:59:59`);

        const [bookingsResult, blockingsResult, schedulesResult] = await Promise.all([
          supabase
            .from("bookings")
            .select(`
              *,
              customer:customers(id, name, email, phone),
              service:services!bookings_service_id_fkey(id, name, duration_min, price_cents),
              staff:staff(id, name)
            `)
            .eq("tenant_id", tenantId)
            .gte("starts_at", start.toISOString())
            .lte("starts_at", end.toISOString())
            .order("starts_at"),

          supabase
            .from("staff_blockings")
            .select("*")
            .eq("tenant_id", tenantId)
            .gte("start_at", start.toISOString())
            .lte("end_at", end.toISOString())
            .order("start_at"),

          supabase
            .from("staff_schedules")
            .select("staff_id, start_time, end_time")
            .eq("tenant_id", tenantId)
            .eq("is_active", true),
        ]);

        if (bookingsResult.error) throw bookingsResult.error;
        if (blockingsResult.error) throw blockingsResult.error;
        if (schedulesResult.error) throw schedulesResult.error;

        setBookings(bookingsResult.data as Booking[]);
        setStaffBlockings(blockingsResult.data);
        setStaffSchedules(schedulesResult.data);
      } catch (err) {
        console.error("Error loading calendar data:", err);
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, selectedDate, supabase]);

  // Group bookings by staff
  const bookingsByStaff = useMemo(() => {
    const map = new Map<string, Booking[]>();
    staffList.forEach((staff) => {
      map.set(staff.id, []);
    });

    bookings.forEach((booking) => {
      if (booking.staff_id && map.has(booking.staff_id)) {
        map.get(booking.staff_id)!.push(booking);
      }
    });

    return map;
  }, [bookings, staffList]);

  // Group blockings by staff
  const blockingsByStaff = useMemo(() => {
    const map = new Map<string, StaffBlocking[]>();
    staffList.forEach((staff) => {
      map.set(staff.id, []);
    });

    staffBlockings.forEach((blocking) => {
      if (blocking.staff_id && map.has(blocking.staff_id)) {
        map.get(blocking.staff_id)!.push(blocking);
      }
    });

    return map;
  }, [staffBlockings, staffList]);

  // Refresh function
  const refreshData = async (targetDate?: string) => {
    if (!tenantId) return;

    const dateToRefresh = targetDate || selectedDate;
    const start = new Date(`${dateToRefresh}T00:00:00`);
    const end = new Date(`${dateToRefresh}T23:59:59`);

    try {
      const [bookingsResult, blockingsResult] = await Promise.all([
        supabase
          .from("bookings")
          .select(`
            *,
            customer:customers(id, name, email, phone),
            service:services!bookings_service_id_fkey(id, name, duration_min, price_cents),
            staff:staff(id, name)
          `)
          .eq("tenant_id", tenantId)
          .gte("starts_at", start.toISOString())
          .lte("starts_at", end.toISOString())
          .order("starts_at"),

        supabase
          .from("staff_blockings")
          .select("*")
          .eq("tenant_id", tenantId)
          .gte("start_at", start.toISOString())
          .lte("end_at", end.toISOString())
          .order("start_at"),
      ]);

      if (bookingsResult.data) setBookings(bookingsResult.data as Booking[]);
      if (blockingsResult.data) setStaffBlockings(blockingsResult.data);
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  };

  return {
    bookings,
    staffBlockings,
    staffSchedules,
    bookingsByStaff,
    blockingsByStaff,
    loading,
    error,
    refreshData,
  };
}
