/**
 * Tool: list_staff_services
 *
 * Servicios del catálogo asignados a un profesional (staff_provides_services
 * + join a services).
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { centsToEur, ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  staffId: z.string().uuid(),
  includeInactiveServices: z
    .boolean()
    .default(false)
    .describe("Si true, incluye servicios desactivados en el catálogo."),
});

export interface StaffServiceItem {
  serviceId: string;
  name: string;
  durationMin: number;
  priceEur: string;
  category: string;
  active: boolean;
}

interface ListPayload {
  staffName: string | null;
  count: number;
  services: StaffServiceItem[];
}

export function buildListStaffServicesTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Lista los servicios del catálogo que puede realizar un miembro concreto del staff. Úsalo antes de asignar/quitar o para saber '¿qué hace Laura?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_staff_services",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const { data: st, error: stE } = await supabase
            .from("staff")
            .select("id, name, display_name")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();
          if (stE || !st) {
            return err("Profesional no encontrado.");
          }
          const stRow = st as {
            id: string;
            name: string | null;
            display_name: string | null;
          };
          const staffName = stRow.display_name ?? stRow.name ?? null;

          const { data: links, error: lErr } = await (supabase
            .from("staff_provides_services") as any)
            .select("service_id")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId);

          if (lErr) {
            return err("No se pudieron leer los servicios asignados.");
          }

          const serviceIds = (
            (links as unknown as Array<{ service_id: string }>) ?? []
          ).map((l) => l.service_id);
          if (serviceIds.length === 0) {
            return ok<ListPayload>(
              `${staffName ?? "Ese profesional"} aún no tiene servicios asignados en el catálogo.`,
              { staffName, count: 0, services: [] },
            );
          }

          const { data: svcs, error: sErr } = await (supabase.from("services") as any)
            .select("id, name, duration_min, price_cents, category, active")
            .eq("tenant_id", ctx.tenantId)
            .in("id", serviceIds);

          if (sErr) {
            return err("No se pudieron leer el detalle de los servicios.");
          }

          const rows =
            (svcs as unknown as Array<{
              id: string;
              name: string;
              duration_min: number;
              price_cents: number;
              category: string;
              active: boolean;
            }>) ?? [];

          let items: StaffServiceItem[] = rows.map((r) => ({
            serviceId: r.id,
            name: r.name,
            durationMin: r.duration_min,
            priceEur: centsToEur(r.price_cents),
            category: r.category,
            active: r.active,
          }));

          if (!input.includeInactiveServices) {
            items = items.filter((i) => i.active);
          }

          const n = items.length;
          return ok<ListPayload>(
            n === 0
              ? `${staffName ?? "Ese profesional"} aún no tiene servicios asignados en el catálogo.`
              : `**${staffName ?? "Staff"}** puede ofrecer **${n}** servicio(s) del catálogo.`,
            { staffName, count: n, services: items },
          );
        },
      );
    },
  });
}
