/**
 * Tool: list_payments
 *
 * Lista pagos del negocio (tabla `payments`, registra cada cobro vía
 * Stripe). Filtros opcionales: estado del pago, estado de balance
 * (wallet), customer, booking, rango de fechas.
 *
 * Usar para "¿qué cobros llevamos este mes?", "¿algún reembolso esta
 * semana?", "¿cuánto llevamos pendiente de payout?".
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  formatDateHuman,
  formatEur,
  ok,
  err,
  withAudit,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Ventana en días hacia atrás desde hoy."),
  status: z
    .enum(["pending", "succeeded", "refunded", "disputed", "failed"])
    .optional(),
  balanceStatus: z
    .enum(["pending", "available", "paid_out"])
    .optional()
    .describe(
      "Estado de balance (wallet): pending=en custodia, available=disponible, paid_out=transferido a banco.",
    ),
  bookingId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

interface PaymentItem {
  paymentId: string;
  whenHuman: string;
  amountEur: string;
  status: string;
  balanceStatus: string | null;
  customerName: string | null;
  bookingId: string | null;
}

interface ListPayload {
  days: number;
  count: number;
  totalSucceededEur: string;
  totalRefundedEur: string;
  pendingPayoutEur: string;
  items: PaymentItem[];
}

export function buildListPaymentsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista los pagos del negocio en los últimos N días con filtros (estado, balance_status, customer, booking). Devuelve totales cobrado / reembolsado / pendiente de payout. Útil para cuadrar caja o revisar reembolsos.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_payments",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const sinceIso = new Date(
            Date.now() - input.days * 24 * 3600 * 1000,
          ).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("payments")
            .select(
              "id, amount, status, balance_status, customer_name, customer_email, booking_id, created_at",
            )
            .eq("tenant_id", ctx.tenantId)
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(input.limit);

          if (input.status) query = query.eq("status", input.status);
          if (input.balanceStatus)
            query = query.eq("balance_status", input.balanceStatus);
          if (input.bookingId) query = query.eq("booking_id", input.bookingId);

          const { data, error } = await query;
          if (error) return err("No se pudieron consultar los pagos.");

          const rows =
            ((data as unknown) as Array<{
              id: string;
              amount: number | string | null;
              status: string;
              balance_status: string | null;
              customer_name: string | null;
              customer_email: string | null;
              booking_id: string | null;
              created_at: string;
            }>) ?? [];

          // payments.amount es numeric(10,2) — viene como string desde PostgREST.
          const toNum = (v: number | string | null): number => {
            if (v == null) return 0;
            return typeof v === "string" ? parseFloat(v) : v;
          };

          let totalSucceeded = 0;
          let totalRefunded = 0;
          let pendingPayout = 0;
          const items: PaymentItem[] = rows.map((r) => {
            const amt = toNum(r.amount);
            if (r.status === "succeeded") totalSucceeded += amt;
            if (r.status === "refunded") totalRefunded += amt;
            if (
              r.status === "succeeded" &&
              (r.balance_status === "pending" || r.balance_status === "available")
            ) {
              pendingPayout += amt;
            }
            return {
              paymentId: r.id,
              whenHuman: formatDateHuman(r.created_at, tenantTimezone),
              amountEur: formatEur(amt),
              status: r.status,
              balanceStatus: r.balance_status,
              customerName: r.customer_name,
              bookingId: r.booking_id,
            };
          });

          const summary =
            items.length === 0
              ? `Sin pagos en los últimos ${input.days} días con esos filtros.`
              : `${items.length} pago(s) · cobrado ${formatEur(totalSucceeded)} · reembolsado ${formatEur(totalRefunded)} · pendiente payout ${formatEur(pendingPayout)}.`;

          return ok<ListPayload>(summary, {
            days: input.days,
            count: items.length,
            totalSucceededEur: formatEur(totalSucceeded),
            totalRefundedEur: formatEur(totalRefunded),
            pendingPayoutEur: formatEur(pendingPayout),
            items,
          });
        },
      );
    },
  });
}
