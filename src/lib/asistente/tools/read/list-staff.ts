/**
 * Tool: list_staff
 *
 * Lista los miembros del staff del tenant. Por defecto solo activos.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  includeInactive: z.boolean().default(false),
  onlyProviders: z
    .boolean()
    .default(true)
    .describe(
      "Solo quienes realizan servicios (provides_services=true). Por defecto true.",
    ),
});

interface StaffItem {
  staffId: string;
  name: string;
  role: string | null;
  active: boolean;
  providesServices: boolean;
  skills: string[];
  weeklyHours: number | null;
  color: string | null;
}

interface ListPayload {
  count: number;
  items: StaffItem[];
}

export function buildListStaffTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Lista el staff del negocio: nombre, rol, servicios que cubre y si está activo. Útil para '¿quién trabaja hoy?', '¿qué barberos tengo?', '¿María cubre colorimetría?'.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutput<ListPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "list_staff",
          toolCategory: "READ_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let query: any = supabase
            .from("staff")
            .select(
              "id, name, display_name, role, active, provides_services, skills, weekly_hours, color",
            )
            .eq("tenant_id", ctx.tenantId)
            .order("display_name", { ascending: true });

          if (!input.includeInactive) query = query.eq("active", true);
          if (input.onlyProviders) query = query.eq("provides_services", true);

          const { data, error } = await query;
          if (error) return err("No se pudo consultar el staff.");

          const items: StaffItem[] = (
            (data as Array<{
              id: string;
              name: string | null;
              display_name: string | null;
              role: string | null;
              active: boolean | null;
              provides_services: boolean | null;
              skills: string[] | null;
              weekly_hours: number | null;
              color: string | null;
            }>) ?? []
          ).map((r) => ({
            staffId: r.id,
            name: r.display_name ?? r.name ?? "(sin nombre)",
            role: r.role,
            active: !!r.active,
            providesServices: !!r.provides_services,
            skills: r.skills ?? [],
            weeklyHours: r.weekly_hours,
            color: r.color,
          }));

          const summary =
            items.length === 0
              ? "No hay personal registrado."
              : `El equipo tiene ${items.length} persona(s)${
                  input.onlyProviders ? " que prestan servicios" : ""
                }${input.includeInactive ? " (incluyendo inactivos)" : ""}.`;

          return ok<ListPayload>(summary, { count: items.length, items });
        },
      );
    },
  });
}
