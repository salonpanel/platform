/**
 * Tool: list_staff_blockings
 *
 * Lista bloqueos (ausencias, vacaciones, reuniones) próximos o en un
 * rango concreto. Respuestas tipo "¿quién está de vacaciones la próxima
 * semana?" o "¿qué bloqueos hay hoy?".
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  formatDateHuman,
  ok,
  err,
  withAudit,
  type ToolOutput,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Inicio (YYYY-MM-DD). Por defecto, hoy."),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Fin inclusive (YYYY-MM-DD). Por defecto, hoy + 30 días."),
  staffId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

interface BlockingItem {
  blockingId: string;
  staffId: string;
  staffName: string | null;
  startHuman: string;
  endHuman: string;
  type: string;
  reason: string | null;
}

interface ListPayload {
  fromDate: string;
  toDate: string;
  count: number;
  items: BlockingItem[];
}

export function buildListStaffBlockingsTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista bloqueos de agenda (vacaciones, ausencias, bloqueos puntuales) del equipo en un rango. Por defecto, los próximos 30 días. Útil para '¿quién libra esta semana?', '¿qué vacaciones hay en mayo?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_staff_blockings",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          const today = new Date().toISOString().slice(0, 10);
          const defaultTo = new Date(Date.now() + 30 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10);
          const fromDate = input.fromDate ?? today;
          const toDate = input.toDate ?? defaultTo;
          if (fromDate > toDate) return err("fromDate debe ser <= toDate.");

          const startIso = new Date(`${fromDate}T00:00:00Z`).toISOString();
          const endIso = new Date(
            new Date(`${toDate}T23:59:59Z`).getTime() + 24 * 3600 * 1000,
          ).toISOString();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("staff_blockings")
            .select(
              "id, staff_id, start_at, end_at, type, reason, staff:staff(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            // Solapamiento: bloqueos cuyo rango intersecta [from, to).
            .lt("start_at", endIso)
            .gt("end_at", startIso)
            .order("start_at", { ascending: true })
            .limit(input.limit);

          if (input.staffId) query = query.eq("staff_id", input.staffId);

          const { data, error } = await query;
          if (error) return err("No se pudieron consultar los bloqueos.");

          const rows =
            ((data as unknown) as Array<{
              id: string;
              staff_id: string;
              start_at: string;
              end_at: string;
              type: string;
              reason: string | null;
              staff: {
                name: string | null;
                display_name: string | null;
              } | null;
            }>) ?? [];

          const items: BlockingItem[] = rows.map((r) => ({
            blockingId: r.id,
            staffId: r.staff_id,
            staffName: r.staff?.display_name ?? r.staff?.name ?? null,
            startHuman: formatDateHuman(r.start_at, tenantTimezone),
            endHuman: formatDateHuman(r.end_at, tenantTimezone),
            type: r.type,
            reason: r.reason,
          }));

          const rangeText =
            fromDate === toDate ? `el ${fromDate}` : `del ${fromDate} al ${toDate}`;
          const summary =
            items.length === 0
              ? `Sin bloqueos ${rangeText}.`
              : `${items.length} bloqueo(s) ${rangeText}.`;

          return ok<ListPayload>(summary, {
            fromDate,
            toDate,
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
