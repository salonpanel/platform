/**
 * Tool: add_booking_note
 *
 * Añade una línea con timestamp a bookings.internal_notes.
 * Cualquier rol puede anotar. No sobreescribe — concatena.
 *
 * Útil para dejar constancia de cosas del tipo "cliente llegó tarde",
 * "le gustó el corte nuevo", "pedir confirmación con 24h de antelación".
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  formatDateHuman,
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  bookingId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .min(2)
    .max(500)
    .describe("Contenido de la nota, una frase breve."),
  confirm: z.boolean().default(false),
});

interface NotePayload {
  bookingId: string;
  whenHuman: string;
  customerName: string | null;
  appendedLine: string;
  previousLength: number;
  newLength: number;
}

export function buildAddBookingNoteTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Añade una línea con timestamp a las notas internas de una cita. No sobreescribe: concatena. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<NotePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "add_booking_note",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const { data } = await supabase
            .from("bookings")
            .select(
              "id, starts_at, internal_notes, customer:customers(name, full_name)",
            )
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId)
            .maybeSingle();

          const row = data as unknown as {
            id: string;
            starts_at: string;
            internal_notes: string | null;
            customer: {
              name: string | null;
              full_name: string | null;
            } | null;
          } | null;

          if (!row) return err("Cita no encontrada.");

          const customerName =
            row.customer?.full_name ?? row.customer?.name ?? null;
          const existing = (row.internal_notes ?? "").toString();

          const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
          const appendedLine = `[${stamp}] ${input.note}`;
          const newValue = existing
            ? `${existing.trimEnd()}\n${appendedLine}`
            : appendedLine;

          const payload: NotePayload = {
            bookingId: row.id,
            whenHuman: formatDateHuman(row.starts_at, tenantTimezone),
            customerName,
            appendedLine,
            previousLength: existing.length,
            newLength: newValue.length,
          };

          if (!input.confirm) {
            return preview(
              `Añadir a notas de la cita **${customerName ?? "(sin nombre)"}** (${payload.whenHuman}):\n> ${appendedLine}\n¿Lo guardo?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("bookings") as any)
            .update({
              internal_notes: newValue,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.bookingId);

          if (updErr) return err(`No se pudo guardar la nota: ${updErr.message}`);

          return ok<NotePayload>(
            `Nota añadida a la cita de ${customerName ?? "cliente"}.`,
            payload,
          );
        },
      );
    },
  });
}
