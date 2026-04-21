/**
 * Tool: get_pending_payments
 *
 * Devuelve los pagos pendientes (reservas con payment_status='unpaid'
 * y estado activo) del tenant. Incluye un resumen con el importe total.
 *
 * Tool category: READ_LOW (sin PII sensible más allá de nombre de cliente,
 * que el sistema trata como dato envuelto).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, formatDateHuman, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Máximo de reservas con pago pendiente a listar (1-50)."),
  onlyFuture: z
    .boolean()
    .default(false)
    .describe("Si true, solo citas futuras. Si false, también pasadas no cobradas."),
});

interface PendingItem {
  bookingId: string;
  customerName: string | null;
  serviceName: string | null;
  whenHuman: string;
  amountEur: string;
  amountCents: number;
}

interface PendingPayload {
  totalAmountEur: string;
  totalAmountCents: number;
  count: number;
  items: PendingItem[];
}

export function buildGetPendingPaymentsTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Devuelve los pagos pendientes del negocio: reservas marcadas como 'unpaid'. Incluye importe total, número de pagos pendientes y una lista de hasta N reservas con cliente, servicio y fecha/hora.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<PendingPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_pending_payments",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const nowIso = new Date().toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("bookings")
            .select(
              "id, starts_at, price_cents, customer:customers(name, full_name), service:services(name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("payment_status", "unpaid")
            .in("status", ["confirmed", "completed"])
            .order("starts_at", { ascending: false })
            .limit(input.limit);

          if (input.onlyFuture) {
            query = query.gte("starts_at", nowIso);
          }

          const { data, error } = await query;
          if (error) {
            return err(
              "No se pudieron consultar los pagos pendientes.",
              "Reintenta en un momento; si persiste, revisa los logs del backend.",
            );
          }

          const rows =
            (data as Array<{
              id: string;
              starts_at: string;
              price_cents: number | null;
              customer: { name: string | null; full_name: string | null } | null;
              service: { name: string | null } | null;
            }>) ?? [];

          // Total agregado (solo del listado devuelto; para el total global
          // hacemos una segunda query count+sum).
          const { data: agg } = await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .rpc("asistente_pending_payments_summary" as any, {
              p_tenant_id: ctx.tenantId,
              p_only_future: input.onlyFuture,
            } as Record<string, unknown>);

          // Fallback si la RPC no existe: sumamos sobre el listado devuelto.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aggRow = Array.isArray(agg) ? (agg[0] as any) : (agg as any);
          const totalCount: number =
            aggRow?.total_count ?? rows.length;
          const totalCents: number =
            aggRow?.total_cents ??
            rows.reduce((acc, r) => acc + (r.price_cents ?? 0), 0);

          const items: PendingItem[] = rows.map((r) => ({
            bookingId: r.id,
            customerName:
              r.customer?.full_name ?? r.customer?.name ?? null,
            serviceName: r.service?.name ?? null,
            whenHuman: formatDateHuman(r.starts_at, "Europe/Madrid"),
            amountCents: r.price_cents ?? 0,
            amountEur: centsToEur(r.price_cents ?? 0),
          }));

          const summary =
            totalCount === 0
              ? "No hay pagos pendientes."
              : `Hay ${totalCount} pago(s) pendiente(s) por un total de ${centsToEur(
                  totalCents,
                )}.`;

          return ok<PendingPayload>(summary, {
            totalAmountEur: centsToEur(totalCents),
            totalAmountCents: totalCents,
            count: totalCount,
            items,
          });
        },
      );
    },
  });
}
