/**
 * Tool: unassign_service_from_staff
 *
 * Elimina el enlace servicio–profesional.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  denyByRole,
  hasRoleAtLeast,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  staffId: z.string().uuid(),
  serviceId: z.string().uuid(),
  confirm: z.boolean().default(false),
});

interface Payload {
  staffName: string;
  serviceName: string;
  wasLinked: boolean;
}

export function buildUnassignServiceFromStaffTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Quita a un miembro del staff un servicio del catálogo (deja de ofrecerlo). Requiere manager+; preview → confirm. Si no estaba enlazado, se informa sin error.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "unassign_service_from_staff",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("quitar servicios a personal", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const { data: st } = await supabase
            .from("staff")
            .select("id, name, display_name")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.staffId)
            .maybeSingle();
          if (!st) {
            return err("Profesional no encontrado.");
          }
          const sRow = st as { display_name: string | null; name: string | null };
          const staffName = (sRow.display_name ?? sRow.name ?? "Staff").trim();

          const { data: se } = await supabase
            .from("services")
            .select("id, name")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId)
            .maybeSingle();
          if (!se) {
            return err("Servicio no encontrado en tu catálogo.");
          }
          const serviceName = (se as { name: string }).name;

          const { data: link } = await (supabase.from("staff_provides_services") as any)
            .select("id")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId)
            .eq("service_id", input.serviceId)
            .maybeSingle();

          if (!link) {
            return ok<Payload>(
              `**${staffName}** no tenía asignado **${serviceName}** — nada que quitar.`,
              { staffName, serviceName, wasLinked: false },
            );
          }

          if (!input.confirm) {
            return preview(
              `Vas a quitar **${serviceName}** de la ficha de **${staffName}**. ¿Confirmas?`,
              { staffName, serviceName, wasLinked: true },
              "Listo para desasignar el servicio.",
            );
          }

          const { error: delE } = await (supabase.from("staff_provides_services") as any)
            .delete()
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId)
            .eq("service_id", input.serviceId);
          if (delE) {
            return err("No se pudo quitar la asignación.");
          }

          return ok<Payload>(`**${staffName}** ya no ofrece **${serviceName}**.`, {
            staffName,
            serviceName,
            wasLinked: true,
          });
        },
      );
    },
  });
}
