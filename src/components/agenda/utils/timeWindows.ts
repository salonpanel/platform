import { StaffBlocking, StaffSchedule } from "@/types/agenda";

export type TimeWindow = { startMinutes: number; endMinutes: number };

export type StaffWindowsMap = Record<string, TimeWindow[]>;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

function subtractIntervals(base: TimeWindow, blocks: TimeWindow[]): TimeWindow[] {
  let result: TimeWindow[] = [base];

  const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);

  for (const block of sortedBlocks) {
    const next: TimeWindow[] = [];

    for (const win of result) {
      if (block.endMinutes <= win.startMinutes || block.startMinutes >= win.endMinutes) {
        next.push(win);
        continue;
      }

      if (block.startMinutes > win.startMinutes) {
        next.push({ startMinutes: win.startMinutes, endMinutes: block.startMinutes });
      }

      if (block.endMinutes < win.endMinutes) {
        next.push({ startMinutes: block.endMinutes, endMinutes: win.endMinutes });
      }
    }

    result = next;
  }

  return result.filter(w => w.endMinutes > w.startMinutes);
}

export function buildStaffWindowsForDay(
  staffSchedules: StaffSchedule[],
  staffBlockings: StaffBlocking[],
  selectedDate: string,
  timezone: string
): StaffWindowsMap {
  const windowsByStaff: StaffWindowsMap = {};

  const blockingsByStaff: Record<string, StaffBlocking[]> = {};
  for (const blocking of staffBlockings) {
    if (!blocking.staff_id) continue;

    const startsAt = new Date(blocking.start_at);
    const localStartsAt = new Date(
      startsAt.toLocaleString("en-US", { timeZone: timezone })
    );

    const year = Number(selectedDate.slice(0, 4));
    const month = Number(selectedDate.slice(5, 7)) - 1;
    const day = Number(selectedDate.slice(8, 10));

    const sameDay =
      localStartsAt.getFullYear() === year &&
      localStartsAt.getMonth() === month &&
      localStartsAt.getDate() === day;

    if (!sameDay) continue;

    if (!blockingsByStaff[blocking.staff_id]) {
      blockingsByStaff[blocking.staff_id] = [];
    }
    blockingsByStaff[blocking.staff_id].push(blocking);
  }

  for (const schedule of staffSchedules) {
    const baseStart = timeToMinutes(schedule.start_time);
    const baseEnd = timeToMinutes(schedule.end_time);

    if (baseEnd <= baseStart) {
      windowsByStaff[schedule.staff_id] = [];
      continue;
    }

    const baseWindow: TimeWindow = { startMinutes: baseStart, endMinutes: baseEnd };

    const staffBlocks = blockingsByStaff[schedule.staff_id] ?? [];

    const blockWindows: TimeWindow[] = staffBlocks.map((blocking) => {
      const startsAt = new Date(blocking.start_at);
      const endsAt = new Date(blocking.end_at);
      const localStartsAt = new Date(
        startsAt.toLocaleString("en-US", { timeZone: timezone })
      );
      const localEndsAt = new Date(
        endsAt.toLocaleString("en-US", { timeZone: timezone })
      );

      const startMinutes = localStartsAt.getHours() * 60 + localStartsAt.getMinutes();
      const endMinutes = localEndsAt.getHours() * 60 + localEndsAt.getMinutes();

      return { startMinutes, endMinutes };
    });

    const availabilityWindows = subtractIntervals(baseWindow, blockWindows);
    windowsByStaff[schedule.staff_id] = availabilityWindows.sort(
      (a, b) => a.startMinutes - b.startMinutes
    );
  }

  return windowsByStaff;
}
