/**
 * Tool: find_reactivation_candidates
 *
 * Busca clientes que hace X meses solían venir pero ahora están dormidos.
 * Filtra por visitas mínimas, opt-in de marketing, excluye baneados y
 * clientes con cita futura ya agendada. Devuelve una lista priorizada por
 * valor (total_spent_cents DESC) para enviarles campaña.
 *
 * Pensada para el flujo "oye, hazme una lista de clientes que no han
 * vuelto en 3 meses, solo los que aceptan marketing" → el LLM llama esta
 * tool y luego puede sugerir create_marketing_campaign (futura).
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
  inactiveMonths: z
    .number()
    .int()
    .min(1)
    .max(24)
    .default(3)
    .describe("Meses sin visitar para considerar al cliente dormido."),
  minVisits: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(2)
    .describe("Mínimo de visitas históricas para filtrar ruido."),
  requireMarketingOptIn: z
    .boolean()
    .default(true)
    .describe("Si true, solo clientes con marketing_opt_in = true."),
  excludeVip: z
    .boolean()
    .default(false)
    .describe("Si true, excluye clientes VIP (se les trata aparte)."),
  limit: z.number().int().min(1).max(100).default(30),
});

interface Candidate {
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  visits: number;
  totalSpentEur: string;
  lastVisitIso: string | null;
  lastVisitHuman: string | null;
  daysInactive: number | null;
  isVip: boolean;
}

interface CandidatesPayload {
  inactiveMonths: number;
  minVisits: number;
  count: number;
  items: Candidate[];
}

export function buildFindReactivationCandidatesTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Encuentra clientes dormidos que solían venir y ahora llevan X meses sin pisar el local. Filtra por marketing_opt_in, visitas mínimas y excluye baneados. Ordena por valor (gasto total). Útil para preparar campañas de reactivación.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<CandidatesPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "find_reactivation_candidates",
          toolCategory: "READ_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - input.inactiveMonths);
          const cutoffIso = cutoff.toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("customers")
            .select(
              "id, name, full_name, email, phone, visits_count, total_spent_cents, last_booking_at, is_vip, is_banned, marketing_opt_in",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("is_banned", false)
            .gte("visits_count", input.minVisits)
            .not("last_booking_at", "is", null)
            .lt("last_booking_at", cutoffIso)
            .order("total_spent_cents", { ascending: false, nullsFirst: false })
            .limit(input.limit);

          if (input.requireMarketingOptIn) {
            query = query.eq("marketing_opt_in", true);
          }
          if (input.excludeVip) {
            query = query.eq("is_vip", false);
          }

          const { data, error } = await query;
          if (error) return err("No se pudo buscar candidatos.");

          const rows =
            (data as unknown as Array<{
              id: string;
              name: string | null;
              full_name: string | null;
              email: string | null;
              phone: string | null;
              visits_count: number | null;
              total_spent_cents: number | null;
              last_booking_at: string | null;
              is_vip: boolean | null;
            }>) ?? [];

          if (rows.length === 0) {
            return ok<CandidatesPayload>(
              `Sin candidatos de reactivación con esos filtros (≥${input.minVisits} visitas, sin venir ${input.inactiveMonths} meses).`,
              {
                inactiveMonths: input.inactiveMonths,
                minVisits: input.minVisits,
                count: 0,
                items: [],
              },
            );
          }

          // Excluir los que ya tienen cita futura agendada.
          const nowIso = new Date().toISOString();
          const ids = rows.map((r) => r.id);
          const { data: future } = await supabase
            .from("bookings")
            .select("customer_id")
            .eq("tenant_id", ctx.tenantId)
            .in("customer_id", ids)
            .in("status", ["pending", "confirmed"])
            .gte("starts_at", nowIso);
          const withFuture = new Set(
            ((future as Array<{ customer_id: string | null }> | null) ?? [])
              .map((r) => r.customer_id)
              .filter((v): v is string => !!v),
          );

          const items: Candidate[] = rows
            .filter((r) => !withFuture.has(r.id))
            .map((r) => {
              const lastIso = r.last_booking_at;
              const daysInactive = lastIso
                ? Math.round(
                    (Date.now() - new Date(lastIso).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;
              return {
                customerId: r.id,
                name: r.full_name ?? r.name ?? null,
                email: r.email,
                phone: r.phone,
                visits: r.visits_count ?? 0,
                totalSpentEur: centsToEur(r.total_spent_cents ?? 0),
                lastVisitIso: lastIso,
                lastVisitHuman: lastIso
                  ? formatDateHuman(lastIso, tenantTimezone)
                  : null,
                daysInactive,
                isVip: !!r.is_vip,
              };
            });

          const summary = `${items.length} cliente(s) dormidos ≥${input.inactiveMonths} meses (min ${input.minVisits} visitas)${input.requireMarketingOptIn ? ", con opt-in de marketing" : ""}.`;

          return ok<CandidatesPayload>(summary, {
            inactiveMonths: input.inactiveMonths,
            minVisits: input.minVisits,
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
