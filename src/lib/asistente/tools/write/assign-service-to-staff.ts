/**
 * Tool: assign_service_to_staff
 *
 * Enlaza un servicio del catálogo a un profesional (INSERT en
 * staff_provides_services, idempotente si ya existía).
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
  alreadyLinked: boolean;
}

export function buildAssignServiceToStaffTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Asigna a un miembro del staff un servicio del catálogo (para que aparezca en reservas y tarifas asociadas a ese rol). Requiere manager+; preview → confirm. Si la relación ya existía, no hace nada y lo indica.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<Payload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "assign_service_to_staff",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("asignar servicios a personal", ctx.userRole);
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
            .select("id, name, active")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.serviceId)
            .maybeSingle();
          if (!se) {
            return err("Servicio no encontrado en tu catálogo.");
          }
          const svc = se as { name: string; active: boolean };
          if (!svc.active) {
            return err(
              "Ese servicio está desactivado; reactívalo en el catálogo antes de asignarlo.",
            );
          }
          const serviceName = svc.name;

          const { data: exist } = await (supabase.from("staff_provides_services") as any)
            .select("id")
            .eq("tenant_id", ctx.tenantId)
            .eq("staff_id", input.staffId)
            .eq("service_id", input.serviceId)
            .maybeSingle();

          if (exist) {
            return ok<Payload>(
              `**${staffName}** ya tenía asignado **${serviceName}** — no había nada que cambiar.`,
              { staffName, serviceName, alreadyLinked: true },
            );
          }

          if (!input.confirm) {
            return preview(
              `Vas a asignar el servicio **${serviceName}** a **${staffName}**. ¿Confirmas?`,
              { staffName, serviceName, alreadyLinked: false },
              "Listo para enlazar el servicio al profesional.",
            );
          }

          const { error: insE } = await (supabase.from("staff_provides_services") as any)
            .insert({
              tenant_id: ctx.tenantId,
              staff_id: input.staffId,
              service_id: input.serviceId,
            });
          if (insE) {
            return err("No se pudo guardar la asignación (¿duplicada?).");
          }

          return ok<Payload>(`**${staffName}** ahora ofrece **${serviceName}**.`, {
            staffName,
            serviceName,
            alreadyLinked: false,
          });
        },
      );
    },
  });
}
