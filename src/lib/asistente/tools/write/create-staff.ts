/**
 * Tool: create_staff
 *
 * Alta de miembro (sin vincular usuario aún, sin horario — eso se edita luego
 * en el panel). Inserción con admin, equivalente a panel_manage_create_staff
 * (sin RPC por auth.uid).
 *
 * RBAC: owner / admin / manager (mismo espíritu que el panel).
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

const StaffAppRole = z
  .enum(["staff", "manager", "reception"])
  .default("staff")
  .describe("Rol operativo de la ficha (no confundir con el rol de membership).");

const InputSchema = z.object({
  name: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120).optional(),
  weeklyHours: z.number().int().min(0).max(60).default(40),
  staffAppRole: StaffAppRole,
  serviceIds: z
    .array(z.string().uuid())
    .max(50)
    .optional()
    .describe("Servicios que puede ofrecer (IDs de list_services en este tenant)."),
  confirm: z.boolean().default(false),
});

interface CreatePayload {
  name: string;
  displayName: string;
  weeklyHours: number;
  role: string;
  serviceCount: number;
  newStaffId?: string;
}

export function buildCreateStaffTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Crea un miembro de staff (nombre, horas, rol, servicios asignados). No vincula login; para eso hace falta el flujo de invitación del panel. Requiere manager+; preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<CreatePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "create_staff",
          toolCategory: "WRITE_HIGH",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            return denyByRole("dar de alta a personal", ctx.userRole);
          }

          const supabase = getSupabaseAdmin();
          const name = input.name.trim();
          const displayName = (input.displayName ?? name).trim();
          const base: CreatePayload = {
            name,
            displayName,
            weeklyHours: input.weeklyHours,
            role: input.staffAppRole,
            serviceCount: new Set(input.serviceIds ?? []).size,
          };

          if (!input.confirm) {
            return preview(
              `Vas a añadir a **${displayName}** con rol de ficha **${input.staffAppRole}**, **${input.weeklyHours}** h/sem${
                base.serviceCount > 0
                  ? ` y **${base.serviceCount}** servicio(s) enlazado(s)`
                  : ""
              }. ¿Confirmas?`,
              base,
              `Listo para crear el perfil de ${displayName}.`,
            );
          }

          const uniqueServiceIds = [...new Set(input.serviceIds ?? [])];
          if (uniqueServiceIds.length) {
            const { data: services, error: se } = await supabase
              .from("services")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .in("id", uniqueServiceIds);
            if (se) {
              return err("No pude comprobar los servicios indicados.");
            }
            const okIds = (services as { id: string }[] | null) ?? [];
            if (okIds.length !== uniqueServiceIds.length) {
              return err(
                "Uno o más servicios no existen en tu negocio. Revisa los IDs con list_services.",
              );
            }
          }

          const { data: ins, error: insErr } = await (supabase.from("staff") as any)
            .insert({
              tenant_id: ctx.tenantId,
              name,
              display_name: displayName,
              active: true,
              weekly_hours: input.weeklyHours,
              user_id: null,
              role: input.staffAppRole,
              provides_services: true,
            })
            .select("id")
            .single();

          if (insErr || !ins) {
            return err(
              insErr?.message ?? "No se pudo crear el miembro del staff.",
            );
          }

          const newId = (ins as { id: string }).id;

          if (uniqueServiceIds.length) {
            const links = uniqueServiceIds.map((service_id) => ({
              tenant_id: ctx.tenantId,
              staff_id: newId,
              service_id,
            }));
            const { error: lErr } = await (supabase.from("staff_provides_services") as any)
              .insert(links);
            if (lErr) {
              return err("Se creó la ficha pero no se pudieron asignar los servicios.");
            }
          }

          return ok<CreatePayload>(
            `Ficha creada: **${displayName}** (ya en el equipo).`,
            {
              ...base,
              newStaffId: newId,
              serviceCount: uniqueServiceIds.length,
            },
          );
        },
      );
    },
  });
}
