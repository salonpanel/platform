/**
 * Tool: list_services
 *
 * Lista los servicios del tenant: activos por defecto, opcional incluir inactivos.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  includeInactive: z.boolean().default(false),
  category: z.string().optional().describe("Filtrar por categoría (opcional)."),
  limit: z.number().int().min(1).max(100).default(50),
});

interface ServiceItem {
  serviceId: string;
  name: string;
  category: string | null;
  durationMin: number;
  priceEur: string;
  priceCents: number;
  active: boolean;
  description: string | null;
}

interface ListPayload {
  count: number;
  items: ServiceItem[];
}

export function buildListServicesTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Devuelve los servicios del negocio: nombre, categoría, duración en minutos, precio y si están activos. Por defecto solo activos.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_services",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("services")
            .select(
              "id, name, category, duration_min, price_cents, active, description",
            )
            .eq("tenant_id", ctx.tenantId)
            .order("name", { ascending: true })
            .limit(input.limit);

          if (!input.includeInactive) {
            query = query.eq("active", true);
          }
          if (input.category) {
            query = query.eq("category", input.category);
          }

          const { data, error } = await query;
          if (error) {
            return err("No se pudieron consultar los servicios.");
          }

          const items: ServiceItem[] = (
            (data as Array<{
              id: string;
              name: string;
              category: string | null;
              duration_min: number;
              price_cents: number | null;
              active: boolean;
              description: string | null;
            }>) ?? []
          ).map((r) => ({
            serviceId: r.id,
            name: r.name,
            category: r.category,
            durationMin: r.duration_min,
            priceEur: centsToEur(r.price_cents ?? 0),
            priceCents: r.price_cents ?? 0,
            active: r.active,
            description: r.description,
          }));

          const summary =
            items.length === 0
              ? "No hay servicios configurados."
              : `El negocio tiene ${items.length} servicio(s)${
                  input.includeInactive ? " (incluyendo inactivos)" : " activos"
                }.`;

          return ok<ListPayload>(summary, {
            count: items.length,
            items,
          });
        },
      );
    },
  });
}
