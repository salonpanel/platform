/**
 * Tool: get_business_overview
 *
 * Snapshot rápido del día. Combina daily_metrics (si existe para hoy) con
 * queries en vivo para: próxima cita, pendientes de pago, staff en turno.
 * Es el "dime cómo va" genérico: el LLM puede llamarla al empezar la
 * conversación o cuando el usuario pregunte "qué tal el día?".
 *
 * La carga vive en `snapshot/business-day-overview` (misma lógica que el
 * resumen inyectado al abrir el chat).
 */

import { z } from "zod";
import { tool } from "ai";
import { loadBusinessDayOverview } from "../../snapshot/business-day-overview";
import type { DayOverviewPayload } from "../../snapshot/business-day-overview";
import { ok, err, withAudit, type ToolOutput } from "../helpers";
import type { ToolRuntimeContext } from "../registry";

const InputSchema = z.object({}).describe("Sin parámetros — snapshot del día.");

type OverviewPayload = DayOverviewPayload;

export function buildGetBusinessOverviewTool(
  ctx: ToolRuntimeContext,
  tenantTimezone: string,
) {
  return tool({
    description:
      "Snapshot del día: nº citas, completadas, canceladas, ingresos de hoy, ocupación, ticket medio, próxima cita y pendientes de pago. Úsala al inicio de una conversación o cuando el usuario pregunte '¿cómo va el día?', '¿qué tengo hoy?'.",
    inputSchema: InputSchema,
    execute: async (): Promise<ToolOutput<OverviewPayload>> => {
      return withAudit(
        {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId: ctx.sessionId,
          toolName: "get_business_overview",
          toolCategory: "READ_LOW",
          toolInput: null,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        async () => {
          const r = await loadBusinessDayOverview(
            ctx.tenantId,
            tenantTimezone,
          );
          if (!r.ok) {
            return err(r.error);
          }
          return ok<OverviewPayload>(r.summary, r.payload);
        },
      );
    },
  });
}
