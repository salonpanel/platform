/**
 * Tool: add_customer_note
 *
 * Añade una línea a las notas de un cliente — normalmente a `internal_notes`
 * (solo staff/IA), pero opcionalmente a `notes` (compartidas).
 *
 * Es una operación de baja fricción: no borra lo anterior, solo añade una
 * línea con timestamp. Útil para que la IA deje rastro de lo que ha visto
 * o lo que el usuario le ha pedido anotar sobre un cliente.
 *
 * RBAC: cualquier rol autenticado puede dejar notas.
 */

import { z } from "zod";
import { tool } from "ai";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ok,
  err,
  preview,
  withAudit,
  type ToolOutputWithPreview,
} from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({
  customerId: z.string().uuid(),
  note: z
    .string()
    .trim()
    .min(2)
    .max(500)
    .describe("Contenido de la nota, una frase breve."),
  target: z
    .enum(["internal", "public"])
    .default("internal")
    .describe(
      "'internal' = notas staff (por defecto); 'public' = campo notes visible en ficha.",
    ),
  confirm: z.boolean().default(false),
});

interface NotePayload {
  customerId: string;
  customerName: string | null;
  target: "internal" | "public";
  appendedLine: string;
  previousLength: number;
  newLength: number;
}

export function buildAddCustomerNoteTool(ctx: ToolRuntimeContext) {
  return tool({
    description:
      "Añade una línea con timestamp a las notas de un cliente. Por defecto escribe en notas internas (solo staff/IA). No sobreescribe: concatena. Flujo: preview → confirm.",
    inputSchema: InputSchema,
    execute: async (input): Promise<ToolOutputWithPreview<NotePayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "add_customer_note",
          toolCategory: "WRITE_LOW",
          toolInput: input as Record<string, unknown>,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const supabase = getSupabaseAdmin();

          const { data: customer } = await supabase
            .from("customers")
            .select("id, name, full_name, notes, internal_notes")
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.customerId)
            .maybeSingle();

          const row = customer as {
            id: string;
            name: string | null;
            full_name: string | null;
            notes: string | null;
            internal_notes: string | null;
          } | null;

          if (!row) return err("Cliente no encontrado.");

          const customerName = row.full_name ?? row.name ?? null;
          const col = input.target === "internal" ? "internal_notes" : "notes";
          const existing = (row[col] ?? "").toString();

          // Línea con fecha corta (UTC, pero suficiente para trazabilidad).
          const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
          const appendedLine = `[${stamp}] ${input.note}`;
          const newValue = existing
            ? `${existing.trimEnd()}\n${appendedLine}`
            : appendedLine;

          const payload: NotePayload = {
            customerId: row.id,
            customerName,
            target: input.target,
            appendedLine,
            previousLength: existing.length,
            newLength: newValue.length,
          };

          if (!input.confirm) {
            const label =
              input.target === "internal"
                ? "notas internas (solo staff/IA)"
                : "notas visibles";
            return preview(
              `Añadir a **${label}** de ${customerName ?? "cliente"}:\n> ${appendedLine}\n¿Lo guardo?`,
              payload,
            );
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updErr } = await (supabase.from("customers") as any)
            .update({
              [col]: newValue,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", ctx.tenantId)
            .eq("id", input.customerId);

          if (updErr) return err(`No se pudo guardar la nota: ${updErr.message}`);

          return ok<NotePayload>(
            `Nota añadida a ${customerName ?? "cliente"}.`,
            payload,
          );
        },
      );
    },
  });
}
