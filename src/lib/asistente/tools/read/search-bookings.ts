/**
 * Tool: search_bookings
 *
 * Búsqueda libre de reservas por texto (nombre de cliente, servicio o
 * profesional) + filtros de fecha/estado. Rellena el hueco grande que
 * dejaban `list_bookings_range` (requería IDs) y `search_customers`
 * (devolvía clientes, no citas).
 *
 * Útil para: "¿qué citas tiene Laura?", "¿cuándo es la próxima de
 * Carlos?", "¿alguna cita de corte hoy?", "busca la cita de Martínez".
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

const InputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(120)
    .describe(
      "Texto libre: nombre de cliente, servicio, o profesional. Se busca con ilike en los 3.",
    ),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Inicio (YYYY-MM-DD). Por defecto, sin límite inferior."),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Fin (YYYY-MM-DD). Por defecto, sin límite superior."),
  onlyUpcoming: z
    .boolean()
    .default(false)
    .describe("Solo citas futuras (starts_at >= ahora)."),
  status: z
    .enum(["pending", "confirmed", "completed", "cancelled", "no_show"])
    .optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

interface BookingMatch {
  bookingId: string;
  whenHuman: string;
  startIso: string;
  customerId: string | null;
  customerName: string | null;
  serviceName: string | null;
  staffName: string | null;
  status: string;
  paymentStatus: string;
  priceEur: string;
}

interface SearchPayload {
  query: string;
  count: number;
  items: BookingMatch[];
}

export function buildSearchBookingsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Busca citas/reservas por texto libre (nombre de cliente, servicio o profesional) con filtros opcionales de fecha y estado. Úsalo cuando sabes a quién buscas pero no el ID — p.ej. '¿qué citas tiene Laura?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<SearchPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "search_bookings",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const q = input.query.trim();

          // PostgREST no deja ilike sobre embed join. Estrategia:
          //  1) Intentamos match por customer (visits_count/email/name) a IDs.
          //  2) Match por service (name) a service IDs.
          //  3) Match por staff (name/display_name) a staff IDs.
          //  4) OR en bookings contra esos IDs.
          const [custRes, svcRes, staffRes] = await Promise.all([
            supabase
              .from("customers")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .or(
                `name.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
              )
              .limit(50),
            supabase
              .from("services")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .ilike("name", `%${q}%`)
              .limit(50),
            supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .or(`name.ilike.%${q}%,display_name.ilike.%${q}%`)
              .limit(50),
          ]);

          const custIds =
            ((custRes.data as { id: string }[] | null) ?? []).map((r) => r.id);
          const svcIds =
            ((svcRes.data as { id: string }[] | null) ?? []).map((r) => r.id);
          const staffIds =
            ((staffRes.data as { id: string }[] | null) ?? []).map((r) => r.id);

          if (
            custIds.length === 0 &&
            svcIds.length === 0 &&
            staffIds.length === 0
          ) {
            return ok<SearchPayload>(`Sin coincidencias para "${q}".`, {
              query: q,
              count: 0,
              items: [],
            });
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("bookings")
            .select(
              "id, starts_at, status, payment_status, price_cents, customer_id, customer:customers(name, full_name), service:services(name), staff:staff!bookings_staff_id_fkey(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .order("starts_at", { ascending: false })
            .limit(input.limit);

          const orClauses: string[] = [];
          if (custIds.length > 0)
            orClauses.push(`customer_id.in.(${custIds.join(",")})`);
          if (svcIds.length > 0)
            orClauses.push(`service_id.in.(${svcIds.join(",")})`);
          if (staffIds.length > 0)
            orClauses.push(`staff_id.in.(${staffIds.join(",")})`);
          query = query.or(orClauses.join(","));

          if (input.onlyUpcoming)
            query = query.gte("starts_at", new Date().toISOString());
          if (input.fromDate)
            query = query.gte(
              "starts_at",
              new Date(`${input.fromDate}T00:00:00Z`).toISOString(),
            );
          if (input.toDate)
            query = query.lte(
              "starts_at",
              new Date(`${input.toDate}T23:59:59Z`).toISOString(),
            );
          if (input.status) query = query.eq("status", input.status);

          const { data, error } = await query;
          if (error) return err("No se pudo buscar en reservas.");

          const rows =
            ((data as unknown) as Array<{
              id: string;
              starts_at: string;
              status: string;
              payment_status: string;
              price_cents: number | null;
              customer_id: string | null;
              customer: {
                name: string | null;
                full_name: string | null;
              } | null;
              service: { name: string | null } | null;
              staff: {
                name: string | null;
                display_name: string | null;
              } | null;
            }>) ?? [];

          const items: BookingMatch[] = rows.map((r) => ({
            bookingId: r.id,
            whenHuman: formatDateHuman(r.starts_at, tenantTimezone),
            startIso: r.starts_at,
            customerId: r.customer_id,
            customerName: r.customer?.full_name ?? r.customer?.name ?? null,
            serviceName: r.service?.name ?? null,
            staffName: r.staff?.display_name ?? r.staff?.name ?? null,
            status: r.status,
            paymentStatus: r.payment_status,
            priceEur: centsToEur(r.price_cents ?? 0),
          }));

          const summary =
            items.length === 0
              ? `Sin coincidencias para "${q}".`
              : `${items.length} cita(s) coinciden con "${q}".`;

          return ok<SearchPayload>(summary, {
            query: q,
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
