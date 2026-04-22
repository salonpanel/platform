/**
 * Tool: create_booking
 *
 * Crea una reserva para un cliente, servicio, staff y hora concretos.
 * Verifica que no haya conflictos con otras reservas del mismo staff.
 *
 * RBAC: todos los roles, pero si el rol es staff solo puede crear citas
 * para su propio staff_id. (El mapping user→staff_id se hace por ahora a
 * través de staff.user_id = ctx.userId).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  centsToEur,
  formatDateHuman,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  startIso: z
    .string()
    .describe(
      "Fecha/hora de inicio en ISO 8601 (con tz). Ej: 2026-04-23T10:00:00+02:00.",
    ),
  internalNotes: z.string().max(1000).optional(),
  confirm: z.boolean().default(false),
});

interface CreateBookingPayload {
  bookingId?: string;
  customerName: string | null;
  serviceName: string;
  staffName: string | null;
  whenHuman: string;
  startIso: string;
  endIso: string;
  priceEur: string;
  durationMin: number;
}

export function buildCreateBookingTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Crea una reserva nueva. Verifica conflictos con otras citas del mismo staff antes de confirmar. Flujo: preview → confirm. Si hay conflicto, devuelve error y propone huecos con find_available_slots.",
    inputSchema: InputSchema,
    execute: async (
      input,
    ): Promise<ToolOutputWithPreview<CreateBookingPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "create_booking",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          // 1. Si es staff, solo puede crear para su propio staff_id.
          if (ctx.userRole === "staff") {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (!selfStaffId || selfStaffId !== input.staffId) {
              return err(
                "Como staff solo puedes crear citas para ti mismo.",
                "Pide a un manager que asigne la cita a otro profesional.",
              );
            }
          }

          // 2. Verificar que todo existe.
          const [custRes, svcRes, staffRes] = await Promise.all([
            supabase
              .from("customers")
              .select("id, name, full_name, is_banned")
              .eq("tenant_id", ctx.tenantId)
              .eq("id", input.customerId)
              .maybeSingle(),
            supabase
              .from("services")
              .select("id, name, duration_min, buffer_min, price_cents, active")
              .eq("tenant_id", ctx.tenantId)
              .eq("id", input.serviceId)
              .maybeSingle(),
            supabase
              .from("staff")
              .select("id, name, display_name, active, provides_services")
              .eq("tenant_id", ctx.tenantId)
              .eq("id", input.staffId)
              .maybeSingle(),
          ]);

          const customer = custRes.data as {
            id: string;
            name: string | null;
            full_name: string | null;
            is_banned: boolean;
          } | null;
          const service = svcRes.data as {
            id: string;
            name: string;
            duration_min: number;
            buffer_min: number | null;
            price_cents: number;
            active: boolean;
          } | null;
          const staff = staffRes.data as {
            id: string;
            name: string | null;
            display_name: string | null;
            active: boolean | null;
            provides_services: boolean | null;
          } | null;

          if (!customer) return err("Cliente no encontrado.");
          if (customer.is_banned)
            return err("Ese cliente está baneado. No se pueden crear citas para él.");
          if (!service) return err("Servicio no encontrado.");
          if (!service.active) return err("El servicio está inactivo.");
          if (!staff) return err("Profesional no encontrado.");
          if (!staff.active || !staff.provides_services)
            return err("Ese profesional no está activo o no presta servicios.");

          // 3. Calcular end e intentar detectar conflictos.
          const startMs = new Date(input.startIso).getTime();
          if (Number.isNaN(startMs))
            return err("startIso no es una fecha/hora válida.");
          if (startMs < Date.now() - 5 * 60 * 1000)
            return err(
              "No se pueden crear reservas en el pasado.",
              "Indica una fecha/hora futura.",
            );

          const durationMin = service.duration_min;
          const endMs = startMs + durationMin * 60 * 1000;
          const startIso = new Date(startMs).toISOString();
          const endIso = new Date(endMs).toISOString();

          const { data: conflicts } = await supabase
            .from("bookings")
            .select("id, starts_at, ends_at, status")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId)
            .in("status", ["pending", "confirmed", "completed"])
            .lt("starts_at", endIso)
            .gt("ends_at", startIso);

          const conflictArr = (conflicts as Array<{
            id: string;
            starts_at: string;
            ends_at: string;
          }>) ?? [];
          if (conflictArr.length > 0) {
            return err(
              "Hay otra cita que se solapa con esa hora para ese profesional.",
              "Usa find_available_slots para ver huecos reales.",
            );
          }

          const customerName = customer.full_name ?? customer.name ?? null;
          const staffName = staff.display_name ?? staff.name ?? null;
          const payload: CreateBookingPayload = {
            customerName,
            serviceName: service.name,
            staffName,
            whenHuman: formatDateHuman(startIso, tenantTimezone),
            startIso,
            endIso,
            priceEur: centsToEur(service.price_cents),
            durationMin,
          };

          if (!input.confirm) {
            return preview(
              `Crear cita para **${customerName ?? "cliente"}** — ${service.name} con ${staffName ?? "staff"} el ${payload.whenHuman} (${durationMin} min, ${payload.priceEur}). ¿La creo?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: created, error: insErr } = await (
            supabase.from("bookings") as any
          )
            .insert({
              tenant_id: ctx.tenantId,
              customer_id: input.customerId,
              service_id: input.serviceId,
              staff_id: input.staffId,
              starts_at: startIso,
              ends_at: endIso,
              duration_min: durationMin,
              price_cents: service.price_cents,
              status: "confirmed",
              booking_state: "confirmed",
              payment_status: "unpaid",
              booking_channel: "assistant",
              booking_source: "bookfast_ai",
              internal_notes: input.internalNotes ?? null,
              requester_type: "staff",
            })
            .select("id")
            .single();

          if (insErr) return err(`No se pudo crear la reserva: ${insErr.message}`);

          return ok<CreateBookingPayload>(
            `Cita creada — ${payload.whenHuman} para **${customerName ?? "cliente"}**.`,
            { ...payload, bookingId: (created as { id: string }).id },
          );
        },
      );
    },
  });
}
