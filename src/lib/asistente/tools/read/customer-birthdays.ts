/**
 * Tool: list_customer_birthdays
 *
 * Clientes con cumpleaños en un mes (por defecto el mes “actual” en la zona
 * del negocio). Útil para campañas o felicitación.
 */

import { z } from "zod";
import { tool } from "ai";
import { formatInTimeZone } from "date-fns-tz";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, toHumanList, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  month: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe("Mes 1–12. Si no indicas, se usa el mes actual en el huso del negocio."),
  limit: z.number().int().min(1).max(200).default(50),
});

interface BirthdayItem {
  dayOfMonth: number;
  name: string;
  /** Solo para el modelo; el resumen al usuario no usa identificadores largos. */
  customerId: string;
}

interface Payload {
  month: number;
  monthName: string;
  count: number;
  items: BirthdayItem[];
}

const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Día calendario desde YYYY-MM-DD (evita desfases UTC en cumpleaños). */
function parseBirthDay(birth: string | null): number {
  if (!birth) {
    return 0;
  }
  const part = birth.split("T")[0] ?? birth;
  const bits = part.split("-");
  return bits.length >= 3 ? parseInt(bits[2]!, 10) : 0;
}

function parseBirthMonth(birth: string | null): number | null {
  if (!birth) {
    return null;
  }
  const part = birth.split("T")[0] ?? birth;
  const bits = part.split("-");
  if (bits.length < 2) {
    return null;
  }
  return parseInt(bits[1]!, 10);
}

export function buildListCustomerBirthdaysTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Lista clientes con cumpleaños en un mes concreto (por defecto el mes corriente en el huso del negocio), ordenados por día. Necesita birth_date rellenado. Para campañas o recordatorios.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_customer_birthdays",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const now = new Date();
          const month =
            input.month ??
            parseInt(
              formatInTimeZone(now, tenantTimezone, "M"),
              10,
            );

          if (month < 1 || month > 12) {
            return err("Mes no válido.");
          }

          const supabase = getSupabaseAdmin();
          const { data, error } = await (supabase.from("customers") as any)
            .select("id, name, full_name, birth_date")
            .eq("tenant_id", ctx.tenantId)
            .not("birth_date", "is", null)
            .limit(5000);

          if (error) {
            return err("No se pudieron leer los clientes.");
          }

          const rows =
            (data as unknown as Array<{
              id: string;
              name: string | null;
              full_name: string | null;
              birth_date: string | null;
            }>) ?? [];

          const inMonth = rows.filter((r) => {
            const m = parseBirthMonth(r.birth_date);
            return m != null && m === month;
          });

          inMonth.sort(
            (a, b) => parseBirthDay(a.birth_date) - parseBirthDay(b.birth_date),
          );

          const sliced = inMonth.slice(0, input.limit);
          const items: BirthdayItem[] = sliced.map((r) => ({
            customerId: r.id,
            name: (r.full_name ?? r.name ?? "Sin nombre").trim(),
            dayOfMonth: parseBirthDay(r.birth_date),
          }));

          const monthName = MONTH_NAMES_ES[month - 1] ?? "ese mes";
          const n = inMonth.length;
          const top = items.slice(0, 5).map(
            (i) => `${i.name} (día ${i.dayOfMonth})`,
          );
          const summary =
            n === 0
              ? `Nadie con cumpleaños en **${monthName}** (o sin fecha guardada).`
              : n <= 5
                ? `Cumpleaños en **${monthName}**: ${toHumanList(top)}.`
                : `**${n}** cumple(s) en **${monthName}**; primeros: ${toHumanList(top)}.`;

          return ok<Payload>(summary, {
            month,
            monthName,
            count: n,
            items,
          });
        },
      );
    },
  });
}
