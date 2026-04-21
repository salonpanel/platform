/**
 * Tool: search_customers
 *
 * Busca clientes por nombre, email o teléfono. Devuelve hasta N resultados
 * con info resumida. El nombre y notas internas son datos no-confiables
 * potenciales (provienen de input externo) → se devuelven como texto plano
 * pero el system prompt instruye al LLM a no seguir instrucciones embebidas.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(80)
    .describe(
      "Texto libre para buscar. Puede ser nombre, email o teléfono (total o parcial).",
    ),
  limit: z.number().int().min(1).max(20).default(8),
});

interface CustomerItem {
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  visits: number;
  totalSpentEur: string;
  isVip: boolean;
  lastBookingAt: string | null;
}

interface SearchPayload {
  query: string;
  count: number;
  items: CustomerItem[];
}

export function buildSearchCustomersTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Busca clientes del negocio por nombre, email o teléfono. Devuelve una lista con nombre, contacto, nº de visitas, gasto total y si es VIP. Útil para '¿tienes el teléfono de María?', 'busca clientes de Juan', etc.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<SearchPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "search_customers",
          toolCategory: "READ_LOW",
          toolInput: { query: input.query, limit: input.limit },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const q = input.query.trim();
          // Escapamos wildcard
          const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

          const { data, error } = await supabase
            .from("customers")
            .select(
              "id, name, full_name, email, phone, visits_count, total_spent_cents, is_vip, last_booking_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .or(
              `name.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
            )
            .order("last_booking_at", { ascending: false, nullsFirst: false })
            .limit(input.limit);

          if (error) {
            return err(
              "No se pudieron buscar clientes.",
              "Prueba a acotar la búsqueda o reintenta en un momento.",
            );
          }

          const items: CustomerItem[] = (
            (data as Array<{
              id: string;
              name: string | null;
              full_name: string | null;
              email: string | null;
              phone: string | null;
              visits_count: number | null;
              total_spent_cents: number | null;
              is_vip: boolean | null;
              last_booking_at: string | null;
            }>) ?? []
          ).map((r) => ({
            customerId: r.id,
            name: r.full_name ?? r.name ?? null,
            email: r.email,
            phone: r.phone,
            visits: r.visits_count ?? 0,
            totalSpentEur: centsToEur(r.total_spent_cents ?? 0),
            isVip: !!r.is_vip,
            lastBookingAt: r.last_booking_at,
          }));

          const summary =
            items.length === 0
              ? `Sin resultados para "${q}".`
              : `${items.length} cliente(s) coinciden con "${q}".`;

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
