/**
 * Tool: delete_staff_blocking
 *
 * Elimina un bloqueo de agenda del staff (vacación, ausencia, bloqueo).
 * Deja esos huecos disponibles de nuevo para ofertar en find_available_slots.
 *
 * RBAC: staff solo para bloqueos propios; manager+ para cualquiera.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  denyByRole,
  formatDateHuman,
  hasRoleAtLeast,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  blockingId: z.string().uuid(),
  confirm: z.boolean().default(false),
});

interface DeletePayload {
  blockingId: string;
  staffId: string;
  staffName: string | null;
  fromHuman: string;
  toHuman: string;
  type: string;
  reason: string | null;
}

export function buildDeleteStaffBlockingTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Elimina un bloqueo existente (vacaciones, ausencia, bloqueo puntual). El tiempo vuelve a estar disponible para reservas. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<DeletePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "delete_staff_blocking",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const { data } = await supabase
            .from("staff_blockings")
            .select(
              "id, staff_id, start_at, end_at, type, reason, staff:staff(name, display_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.blockingId)
            .maybeSingle();

          const row = data as unknown as {
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
          } | null;

          if (!row) return err("Bloqueo no encontrado.");

          if (!hasRoleAtLeast(ctx.userRole, "manager")) {
            const { data: self } = await supabase
              .from("staff")
              .select("id")
              .eq("tenant_id", ctx.tenantId)
              .eq("user_id", ctx.userId)
              .maybeSingle();
            const selfStaffId = (self as { id: string } | null)?.id;
            if (!selfStaffId || selfStaffId !== row.staff_id) {
              return denyByRole(
                "eliminar bloqueos de otros profesionales",
                ctx.userRole,
              );
            }
          }

          const staffName =
            row.staff?.display_name ?? row.staff?.name ?? null;
          const payload: DeletePayload = {
            blockingId: row.id,
            staffId: row.staff_id,
            staffName,
            fromHuman: formatDateHuman(row.start_at, tenantTimezone),
            toHuman: formatDateHuman(row.end_at, tenantTimezone),
            type: row.type,
            reason: row.reason,
          };

          if (!input.confirm) {
            return preview(
              `Eliminar bloqueo de **${staffName ?? "staff"}** del ${payload.fromHuman} al ${payload.toHuman} (${row.type}${row.reason ? ` — ${row.reason}` : ""}).\n¿Lo quito?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: delErr } = await (
            supabase.from("staff_blockings") as any
          )
            .delete()
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.blockingId);

          if (delErr) return err(`No se pudo eliminar: ${delErr.message}`);

          return ok<DeletePayload>(
            `Bloqueo eliminado — ${staffName ?? "staff"} vuelve a estar disponible del ${payload.fromHuman} al ${payload.toHuman}.`,
            payload,
          );
        },
      );
    },
  });
}
