import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { addMinutes, isWithinInterval, parseISO, format } from "date-fns";

export interface StaffSchedule {
  staff_id: string;
  start_time: Date;
  end_time: Date;
  is_available: boolean;
}

export interface StaffBlocking {
  staff_id: string;
  start_time: Date;
  end_time: Date;
  reason?: string;
}

export interface ServiceConfig {
  duration_min: number;
  buffer_min: number;
}

export interface AvailableSlot {
  staff_id: string;
  start_time: Date;
  end_time: Date;
}

/**
 * Get staff schedules for a specific day
 */
export async function getStaffDaySchedule(
  staffId: string,
  date: Date,
  client?: any // SupabaseClient
): Promise<StaffSchedule[]> {
  const supabase = client || getSupabaseBrowser();

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("staff_schedules")
    .select("staff_id, start_time, end_time, is_available")
    .eq("staff_id", staffId)
    .gte("start_time", startOfDay.toISOString())
    .lte("end_time", endOfDay.toISOString())
    .order("start_time");

  if (error) {
    console.error("Error fetching staff schedule:", error);
    return [];
  }

  return data || [];
}

/**
 * Get staff blockings for a specific day
 */
export async function getStaffBlockings(
  staffId: string,
  date: Date,
  client?: any // SupabaseClient
): Promise<StaffBlocking[]> {
  const supabase = client || getSupabaseBrowser();

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("staff_blockings")
    .select("staff_id, start_time, end_time, reason")
    .eq("staff_id", staffId)
    .gte("start_time", startOfDay.toISOString())
    .lte("end_time", endOfDay.toISOString())
    .order("start_time");

  if (error) {
    console.error("Error fetching staff blockings:", error);
    return [];
  }

  return data || [];
}

/**
 * Compute available slots for a staff member and service on a specific date
 */
export async function computeAvailableSlots(
  staffId: string,
  serviceId: string,
  date: Date,
  client?: any // SupabaseClient
): Promise<AvailableSlot[]> {
  const supabase = client || getSupabaseBrowser();

  // Get service config
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_min, buffer_min")
    .eq("id", serviceId)
    .single();

  if (serviceError || !service) {
    console.error("Error fetching service:", serviceError);
    return [];
  }

  // Get schedules and blockings
  const [schedules, blockings] = await Promise.all([
    getStaffDaySchedule(staffId, date, supabase),
    getStaffBlockings(staffId, date, supabase)
  ]);

  // Apply transformations
  let availableSchedules = applySplitSchedules(schedules);
  availableSchedules = applyBlockings(availableSchedules, blockings);
  availableSchedules = applyBuffers(availableSchedules, service);

  // Generate slots based on service duration
  const slots: AvailableSlot[] = [];
  const serviceDurationMs = service.duration_min * 60 * 1000;

  for (const schedule of availableSchedules) {
    const scheduleStart = new Date(schedule.start_time);
    const scheduleEnd = new Date(schedule.end_time);

    let currentTime = new Date(scheduleStart);

    while (currentTime.getTime() + serviceDurationMs <= scheduleEnd.getTime()) {
      slots.push({
        staff_id: staffId,
        start_time: new Date(currentTime),
        end_time: new Date(currentTime.getTime() + serviceDurationMs)
      });

      // Move to next slot (assuming 15-minute intervals for now)
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    }
  }

  return slots;
}

/**
 * Apply blockings to schedules (remove blocked time slots)
 */

/**
 * Apply blockings to schedules (remove blocked time slots)
 */
/**
 * Merge overlapping or adjacent schedules
 */
function applySplitSchedules(schedules: StaffSchedule[]): StaffSchedule[] {
  if (schedules.length === 0) return [];

  // Sort by start time
  const sorted = [...schedules].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const merged: StaffSchedule[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    const currentStart = new Date(current.start_time);
    const lastEnd = new Date(last.end_time);

    // If schedules overlap or are adjacent, merge them
    if (currentStart <= lastEnd) {
      last.end_time = current.end_time > last.end_time ? current.end_time : last.end_time;
    } else {
      merged.push(current);
    }
  }

  return merged.filter(schedule => schedule.is_available);
}

/**
 * Apply blockings to schedules (remove blocked time slots)
 */
export function applyBlockings(
  schedules: StaffSchedule[],
  blockings: StaffBlocking[]
): StaffSchedule[] {
  if (blockings.length === 0) return schedules;

  let result = [...schedules];

  for (const blocking of blockings) {
    result = result.flatMap(schedule => {
      const scheduleStart = new Date(schedule.start_time);
      const scheduleEnd = new Date(schedule.end_time);
      const blockStart = new Date(blocking.start_time);
      const blockEnd = new Date(blocking.end_time);

      // No overlap
      if (blockEnd <= scheduleStart || blockStart >= scheduleEnd) {
        return [schedule];
      }

      // Complete overlap - remove schedule
      if (blockStart <= scheduleStart && blockEnd >= scheduleEnd) {
        return [];
      }

      // Partial overlaps
      const parts: StaffSchedule[] = [];

      // Part before blocking
      if (blockStart > scheduleStart) {
        parts.push({
          ...schedule,
          end_time: blocking.start_time
        });
      }

      // Part after blocking
      if (blockEnd < scheduleEnd) {
        parts.push({
          ...schedule,
          start_time: blocking.end_time
        });
      }

      return parts;
    });
  }

  return result;
}

/**
 * Apply service buffer to schedules
 */
export function applyBuffers(
  schedules: StaffSchedule[],
  service: ServiceConfig
): StaffSchedule[] {
  const bufferMs = service.buffer_min * 60 * 1000; // Convert to milliseconds

  return schedules
    .map(schedule => ({
      ...schedule,
      start_time: new Date(new Date(schedule.start_time).getTime() + bufferMs),
      end_time: new Date(new Date(schedule.end_time).getTime() - bufferMs)
    }))
    .filter(schedule => schedule.start_time < schedule.end_time);
}

/**
 * Compute available slots for a staff member and service on a specific date
 */


/**
 * Get staff windows for a day (used by agenda)
 */
export async function getStaffWindowsForDay(
  staffId: string,
  date: Date
): Promise<{ start: Date; end: Date; available: boolean }[]> {
  const [schedules, blockings] = await Promise.all([
    getStaffDaySchedule(staffId, date),
    getStaffBlockings(staffId, date)
  ]);

  let availableSchedules = applySplitSchedules(schedules);
  availableSchedules = applyBlockings(availableSchedules, blockings);

  return availableSchedules.map(schedule => ({
    start: new Date(schedule.start_time),
    end: new Date(schedule.end_time),
    available: schedule.is_available
  }));
}