/**
 * Tool: find_available_slots
 *
 * Devuelve slots libres para una fecha + servicio + staff (opcional).
 * Combina staff_schedules, staff_blockings y bookings existentes. Mantenemos
 * la lógica intencionadamente simple — si el negocio tiene reglas exóticas,
 * el usuario validará en el calendario.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const InputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Fecha en YYYY-MM-DD en la zona horaria del negocio."),
  serviceId: z
    .string()
    .uuid()
    .describe("UUID del servicio (para saber duración y buffer)."),
  staffId: z
    .string()
    .uuid()
    .optional()
    .describe("UUID del profesional. Si se omite, se considera todo el staff disponible."),
  granularityMin: z
    .number()
    .int()
    .min(5)
    .max(60)
    .default(15)
    .describe("Cada cuántos minutos se prueba un slot inicial."),
  limit: z.number().int().min(1).max(40).default(20),
});

interface SlotItem {
  staffId: string;
  staffName: string | null;
  startIso: string;
  endIso: string;
  startLocal: string; // HH:mm
  endLocal: string;
}

interface AvailabilityPayload {
  date: string;
  serviceId: string;
  serviceName: string | null;
  durationMin: number;
  bufferMin: number;
  count: number;
  slots: SlotItem[];
}

interface Interval {
  start: number; // ms
  end: number;
}

function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  let result = [...base];
  for (const cut of cuts) {
    const next: Interval[] = [];
    for (const iv of result) {
      if (cut.end <= iv.start || cut.start >= iv.end) {
        next.push(iv);
        continue;
      }
      if (cut.start > iv.start) next.push({ start: iv.start, end: cut.start });
      if (cut.end < iv.end) next.push({ start: cut.end, end: iv.end });
    }
    result = next;
  }
  return result.filter((iv) => iv.end > iv.start);
}

export function buildFindAvailableSlotsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Calcula slots libres para una fecha + servicio (y opcionalmente staff). Devuelve huecos que respetan horario del staff, bloqueos y reservas existentes. Útil para '¿cuándo tiene María hueco el viernes?' o 'dame un hueco para corte mañana'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<AvailabilityPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "find_available_slots",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const tz = tenantTimezone || "Europe/Madrid";

          // Servicio
          const { data: svc, error: svcErr } = await supabase
            .from("services")
            .select("id, name, duration_min, buffer_min, active")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId)
            .maybeSingle();
          if (svcErr || !svc) {
            return err("Servicio no encontrado en este negocio.");
          }
          const service = svc as {
            id: string;
            name: string;
            duration_min: number;
            buffer_min: number | null;
            active: boolean;
          };
          if (!service.active) {
            return err(
              "El servicio está inactivo.",
              "Actívalo desde Servicios antes de usarlo.",
            );
          }

          const durationMin = service.duration_min;
          const bufferMin = service.buffer_min ?? 0;
          const totalMin = durationMin + bufferMin;

          // Día → día de la semana en tz del tenant.
          const dayStartLocalIso = `${input.date}T00:00:00`;
          const dayRefZoned = toZonedTime(
            new Date(`${input.date}T12:00:00Z`),
            tz,
          );
          const dayOfWeek = dayRefZoned.getDay(); // 0=domingo

          // Staff candidatos.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let staffQuery: any = supabase
            .from("staff")
            .select("id, name, display_name")
            .eq("tenant_id", ctx.tenantId)
            .eq("active", true)
            .eq("provides_services", true);
          if (input.staffId) staffQuery = staffQuery.eq("id", input.staffId);
          const { data: staffList, error: staffErr } = await staffQuery;
          if (staffErr) return err("No se pudo consultar el staff.");
          const staffArr = (staffList as Array<{
            id: string;
            name: string | null;
            display_name: string | null;
          }>) ?? [];
          if (staffArr.length === 0) {
            return err("Sin staff activo para calcular disponibilidad.");
          }
          const staffIds = staffArr.map((s) => s.id);

          // Horarios del staff para ese día de la semana.
          const { data: schedules } = await supabase
            .from("staff_schedules")
            .select("staff_id, day_of_week, start_time, end_time, is_active")
            .eq("tenant_id", ctx.tenantId)
            .in("staff_id", staffIds)
            .eq("day_of_week", dayOfWeek)
            .eq("is_active", true);

          // Bloqueos y reservas del día.
          const dayStart = new Date(`${input.date}T00:00:00Z`).getTime() - 14 * 3600 * 1000;
          const dayEnd = new Date(`${input.date}T00:00:00Z`).getTime() + 38 * 3600 * 1000;
          const startIso = new Date(dayStart).toISOString();
          const endIso = new Date(dayEnd).toISOString();

          const [blockingsRes, bookingsRes] = await Promise.all([
            supabase
              .from("staff_blockings")
              .select("staff_id, start_at, end_at")
              .eq("tenant_id", ctx.tenantId)
              .in("staff_id", staffIds)
              .lte("start_at", endIso)
              .gte("end_at", startIso),
            supabase
              .from("bookings")
              .select("staff_id, starts_at, ends_at, status")
              .eq("tenant_id", ctx.tenantId)
              .in("staff_id", staffIds)
              .in("status", ["pending", "confirmed", "completed"])
              .lte("starts_at", endIso)
              .gte("ends_at", startIso),
          ]);

          const blockings = (blockingsRes.data as Array<{
            staff_id: string;
            start_at: string;
            end_at: string;
          }>) ?? [];
          const bookings = (bookingsRes.data as Array<{
            staff_id: string;
            starts_at: string;
            ends_at: string;
          }>) ?? [];

          // Para cada staff, calcular intervalos libres.
          const slots: SlotItem[] = [];
          const nowMs = Date.now();

          for (const s of staffArr) {
            const schedRows = (
              (schedules as Array<{
                staff_id: string;
                start_time: string;
                end_time: string;
              }>) ?? []
            ).filter((sch) => sch.staff_id === s.id);

            if (schedRows.length === 0) continue;

            // Construir intervalos de trabajo en ms (interpretando HH:mm en tz local).
            const workIntervals: Interval[] = schedRows.map((sch) => {
              const startIsoLocal = `${input.date}T${sch.start_time.slice(0, 5)}:00`;
              const endIsoLocal = `${input.date}T${sch.end_time.slice(0, 5)}:00`;
              // Interpretamos la hora local tz y convertimos a UTC ms.
              const startMs = localDateInTzToUtcMs(startIsoLocal, tz);
              const endMs = localDateInTzToUtcMs(endIsoLocal, tz);
              return { start: startMs, end: endMs };
            });

            const cuts: Interval[] = [
              ...blockings
                .filter((b) => b.staff_id === s.id)
                .map((b) => ({
                  start: new Date(b.start_at).getTime(),
                  end: new Date(b.end_at).getTime(),
                })),
              ...bookings
                .filter((b) => b.staff_id === s.id)
                .map((b) => ({
                  start: new Date(b.starts_at).getTime(),
                  end: new Date(b.ends_at).getTime(),
                })),
            ];

            const freeIntervals = subtract(workIntervals, cuts);
            const staffName = s.display_name ?? s.name ?? null;
            const granMs = input.granularityMin * 60 * 1000;
            const durMs = durationMin * 60 * 1000;
            const totalMs = totalMin * 60 * 1000;

            for (const iv of freeIntervals) {
              // Cursor alineado a granularidad local.
              let cursor = alignToGranularity(iv.start, granMs);
              if (cursor < iv.start) cursor += granMs;
              while (cursor + totalMs <= iv.end) {
                if (cursor >= nowMs || input.date > todayInTz(tz)) {
                  const startIsoSlot = new Date(cursor).toISOString();
                  const endIsoSlot = new Date(cursor + durMs).toISOString();
                  slots.push({
                    staffId: s.id,
                    staffName,
                    startIso: startIsoSlot,
                    endIso: endIsoSlot,
                    startLocal: formatInTimeZone(new Date(cursor), tz, "HH:mm"),
                    endLocal: formatInTimeZone(
                      new Date(cursor + durMs),
                      tz,
                      "HH:mm",
                    ),
                  });
                }
                cursor += granMs;
                if (slots.length >= input.limit * 2) break;
              }
              if (slots.length >= input.limit * 2) break;
            }
          }

          slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
          const truncated = slots.slice(0, input.limit);

          const summary =
            truncated.length === 0
              ? `Sin huecos para "${service.name}" el ${input.date}.`
              : `${truncated.length} hueco(s) para "${service.name}" el ${input.date} (duración ${durationMin} min${bufferMin ? ` + ${bufferMin} buffer` : ""}).`;

          void dayStartLocalIso; // silenciar ts-unused si fuera necesario

          return ok<AvailabilityPayload>(summary, {
            date: input.date,
            serviceId: service.id,
            serviceName: service.name,
            durationMin,
            bufferMin,
            count: truncated.length,
            slots: truncated,
          });
        },
      );
    },
  });
}

function alignToGranularity(ms: number, granMs: number): number {
  return Math.floor(ms / granMs) * granMs;
}

function localDateInTzToUtcMs(isoLocal: string, tz: string): number {
  // Interpretamos "YYYY-MM-DDTHH:mm:ss" como hora local de `tz`.
  // Estrategia: calculamos el offset de esa fecha/hora en esa tz y lo
  // aplicamos. Es una aproximación; suficiente para huecos que no tocan
  // el cambio de hora.
  const fake = new Date(`${isoLocal}Z`); // asumimos UTC primero
  const zoned = toZonedTime(fake, tz);
  const diff = fake.getTime() - zoned.getTime();
  return fake.getTime() + diff;
}

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
