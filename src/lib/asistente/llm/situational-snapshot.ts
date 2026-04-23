/**
 * Construye el texto inyectado en el system prompt (## Foto del día) antes
 * del primer turno con contexto, para que el LLM tenga cifras sin pedir aún
 * get_business_overview.
 */

import { loadBusinessDayOverview } from "../snapshot/business-day-overview";

/**
 * @returns Párrafo breve, o `null` si no se pudo cargar (el prompt omite la sección).
 */
export async function buildSituationalSummary(
  tenantId: string,
  tenantTimezone: string,
): Promise<string | null> {
  const r = await loadBusinessDayOverview(tenantId, tenantTimezone);
  if (!r.ok) {
    return null;
  }
  return `Al abrir el chat: **${r.payload.dateIso}** (${tenantTimezone}) — ${r.summary}`;
}
