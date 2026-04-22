/**
 * Tool: get_customer_detail
 *
 * Devuelve la ficha de un cliente con resumen operativo: contacto, gasto
 * total, nº visitas, no-shows, staff preferido, próxima cita y últimas 5
 * reservas. Se puede identificar al cliente por customerId (UUID) o por
 * búsqueda por nombre/email/teléfono (se queda con el mejor match).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  centsToEur,
  formatDateHuman,
  ok,
  err,
  withAudit,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z
  .object({
    customerId: z
      .string()
      .uuid()
      .optional()
      .describe("UUID del cliente si ya se conoce."),
    query: z
      .string()
      .min(2)
      .max(80)
      .optional()
      .describe(
        "Nombre, email o teléfono para identificar al cliente. Ignora si ya pasas customerId.",
      ),
  })
  .refine((v) => !!v.customerId || !!v.query, {
    message: "Pasa customerId o query para identificar al cliente.",
  });

interface BookingSummary {
  bookingId: string;
  whenHuman: string;
  serviceName: string | null;
  staffName: string | null;
  status: string;
  paymentStatus: string | null;
  amountEur: string;
}

interface CustomerDetailPayload {
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isVip: boolean;
  isBanned: boolean;
  marketingOptIn: boolean;
  visits: number;
  noShows: number;
  totalSpentEur: string;
  tags: string[];
  notes: string | null;
  preferredStaffName: string | null;
  lastBookingAt: string | null;
  nextBooking: BookingSummary | null;
  recentBookings: BookingSummary[];
}

export function buildGetCustomerDetailTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Devuelve la ficha completa de un cliente: contacto, gasto total, visitas, no-shows, staff preferido, tags, próxima cita y últimas 5 reservas. Identifica al cliente por customerId o por una búsqueda (query) de nombre/email/teléfono.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<CustomerDetailPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_customer_detail",
          toolCategory: "READ_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          // 1. Localizar el cliente.
          let customerId = input.customerId ?? null;
          if (!customerId && input.query) {
            const q = input.query.trim();
            const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
            const { data: matches, error: searchErr } = await supabase
              .from("customers")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .or(
                `name.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
              )
              .order("last_booking_at", { ascending: false, nullsFirst: false })
              .limit(1);
            if (searchErr) {
              return err("No se pudo buscar el cliente.");
            }
            customerId = (matches as Array<{ id: string }> | null)?.[0]?.id ?? null;
            if (!customerId) {
              return err(
                `Sin resultados para "${q}".`,
                "Prueba con otro nombre o un teléfono/email.",
              );
            }
          }

          if (!customerId) {
            return err("No se pudo identificar al cliente.");
          }

          // 2. Ficha.
          const { data: customer, error: custErr } = await supabase
            .from("customers")
            .select(
              "id, name, full_name, email, phone, is_vip, is_banned, marketing_opt_in, visits_count, no_show_count, total_spent_cents, tags, internal_notes, notes, last_booking_at, preferred_staff_id",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", customerId)
            .maybeSingle();

          if (custErr || !customer) {
            return err("Cliente no encontrado en este negocio.");
          }

          const cust = customer as {
            id: string;
            name: string | null;
            full_name: string | null;
            email: string | null;
            phone: string | null;
            is_vip: boolean | null;
            is_banned: boolean | null;
            marketing_opt_in: boolean | null;
            visits_count: number | null;
            no_show_count: number | null;
            total_spent_cents: number | null;
            tags: string[] | null;
            internal_notes: string | null;
            notes: string | null;
            last_booking_at: string | null;
            preferred_staff_id: string | null;
          };

          // 3. Staff preferido (si hay).
          let preferredStaffName: string | null = null;
          if (cust.preferred_staff_id) {
            const { data: staffRow } = await supabase
              .from("staff")
              .select("name, display_name")
              .eq("tenant_id", ctx.tenantId)
              .eq("id", cust.preferred_staff_id)
              .maybeSingle();
            const s = staffRow as {
              name: string | null;
              display_name: string | null;
            } | null;
            preferredStaffName = s?.display_name ?? s?.name ?? null;
          }

          // 4. Reservas recientes (últimas 5) + próxima.
          const tz = "Europe/Madrid";
          const nowIso = new Date().toISOString();

          const recentPromise = supabase
            .from("bookings")
            .select(
              "id, starts_at, status, payment_status, price_cents, service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("customer_id", customerId)
            .order("starts_at", { ascending: false })
            .limit(5);

          const nextPromise = supabase
            .from("bookings")
            .select(
              "id, starts_at, status, payment_status, price_cents, service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("customer_id", customerId)
            .in("status", ["pending", "confirmed"])
            .gte("starts_at", nowIso)
            .order("starts_at", { ascending: true })
            .limit(1);

          const [{ data: recentData }, { data: nextData }] = await Promise.all([
            recentPromise,
            nextPromise,
          ]);

          const rowToSummary = (r: {
            id: string;
            starts_at: string;
            status: string;
            payment_status: string | null;
            price_cents: number | null;
            service: { name: string | null } | null;
            staff: { name: string | null; display_name: string | null } | null;
          }): BookingSummary => ({
            bookingId: r.id,
            whenHuman: formatDateHuman(r.starts_at, tz),
            serviceName: r.service?.name ?? null,
            staffName: r.staff?.display_name ?? r.staff?.name ?? null,
            status: r.status,
            paymentStatus: r.payment_status,
            amountEur: centsToEur(r.price_cents ?? 0),
          });

          const recentBookings = (
            (recentData as unknown as Array<Parameters<typeof rowToSummary>[0]>) ?? []
          ).map(rowToSummary);
          const nextArr =
            (nextData as unknown as Array<Parameters<typeof rowToSummary>[0]>) ?? [];
          const nextBooking = nextArr.length > 0 ? rowToSummary(nextArr[0]) : null;

          const displayName =
            cust.full_name ?? cust.name ?? "(sin nombre)";

          const payload: CustomerDetailPayload = {
            customerId: cust.id,
            name: displayName,
            email: cust.email,
            phone: cust.phone,
            isVip: !!cust.is_vip,
            isBanned: !!cust.is_banned,
            marketingOptIn: !!cust.marketing_opt_in,
            visits: cust.visits_count ?? 0,
            noShows: cust.no_show_count ?? 0,
            totalSpentEur: centsToEur(cust.total_spent_cents ?? 0),
            tags: cust.tags ?? [],
            notes: cust.internal_notes ?? cust.notes ?? null,
            preferredStaffName,
            lastBookingAt: cust.last_booking_at,
            nextBooking,
            recentBookings,
          };

          const summaryParts = [
            `${displayName} — ${payload.visits} visita(s), ${payload.totalSpentEur} gastado`,
          ];
          if (payload.isVip) summaryParts.push("VIP");
          if (payload.noShows > 0) summaryParts.push(`${payload.noShows} no-show(s)`);
          if (payload.nextBooking)
            summaryParts.push(`próxima: ${payload.nextBooking.whenHuman}`);

          return ok<CustomerDetailPayload>(summaryParts.join(" · ") + ".", payload);
        },
      );
    },
  });
}
