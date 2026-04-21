/**
 * Control de budget mensual de tokens / coste por tenant.
 *
 * Cada tenant tiene un tope mensual (en céntimos de EUR) configurable.
 * Por defecto: 50€ / mes.
 *
 * El flujo es:
 *  - Antes de un turno: checkBudget() → si >=100% → bloquear.
 *  - Después de un turno: recordUsage(tokens, cost) → upsert.
 *
 * Cost estimate: tokens * pricePerKToken para el modelo usado. El router
 * Haiku/Sonnet y los precios se mantienen en otro módulo; aquí solo aceptamos
 * el valor ya calculado en céntimos.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface BudgetStatus {
  allowed: boolean;
  reason?: string;
  usedCents: number;
  capCents: number;
  percentUsed: number;
  warnThresholdHit: boolean;
  blockThresholdHit: boolean;
}

function currentPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/**
 * Lee (o crea) la fila de uso del mes actual para el tenant y devuelve
 * el estado del budget.
 */
export async function getBudgetStatus(tenantId: string): Promise<BudgetStatus> {
  const supabase = getSupabaseAdmin();
  const { year, month } = currentPeriod();

  const { data, error } = await supabase
    .from("asistente_usage_monthly")
    .select("budget_cents_cap, budget_cents_used, warn_sent_at, blocked_at")
    .eq("tenant_id", tenantId)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // Fail-safe: ante error de lectura, bloqueamos.
    return {
      allowed: false,
      reason: "budget_read_error",
      usedCents: 0,
      capCents: 0,
      percentUsed: 0,
      warnThresholdHit: false,
      blockThresholdHit: true,
    };
  }

  if (!data) {
    // No existe fila → crear con defaults leyendo la config del tenant.
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("asistente_config")
      .eq("id", tenantId)
      .maybeSingle();

    const cfg = (tenantRow as { asistente_config?: Record<string, unknown> } | null)
      ?.asistente_config ?? {};
    const cap =
      typeof cfg.budget_cents_cap === "number" && cfg.budget_cents_cap > 0
        ? Math.floor(cfg.budget_cents_cap)
        : 5000;

    const insertPayload = {
      tenant_id: tenantId,
      period_year: year,
      period_month: month,
      budget_cents_cap: cap,
      budget_cents_used: 0,
    };

    // Insert best-effort; si carrera, nos da error único y luego leemos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("asistente_usage_monthly") as any).insert(insertPayload);

    return {
      allowed: true,
      usedCents: 0,
      capCents: cap,
      percentUsed: 0,
      warnThresholdHit: false,
      blockThresholdHit: false,
    };
  }

  const row = data as {
    budget_cents_cap: number;
    budget_cents_used: number;
    warn_sent_at: string | null;
    blocked_at: string | null;
  };
  const cap = row.budget_cents_cap ?? 5000;
  const used = row.budget_cents_used ?? 0;
  const percent = cap > 0 ? (used / cap) * 100 : 0;

  const blocked = percent >= 100;
  return {
    allowed: !blocked,
    reason: blocked ? "budget_exceeded" : undefined,
    usedCents: used,
    capCents: cap,
    percentUsed: percent,
    warnThresholdHit: percent >= 80 && !row.warn_sent_at,
    blockThresholdHit: blocked && !row.blocked_at,
  };
}

/**
 * Registra consumo de tokens/coste tras un turno.
 */
export async function recordUsage(opts: {
  tenantId: string;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
  toolCalls: number;
}) {
  const supabase = getSupabaseAdmin();
  const { year, month } = currentPeriod();

  // Atomic increment vía RPC sería ideal; mientras tanto, select+update.
  const { data } = await supabase
    .from("asistente_usage_monthly")
    .select("id, budget_cents_used, tokens_input, tokens_output, tool_calls_count, turns_count")
    .eq("tenant_id", opts.tenantId)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  if (!data) {
    // Rara, debería haber sido creada en getBudgetStatus. Creamos aquí igualmente.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("asistente_usage_monthly") as any).insert({
      tenant_id: opts.tenantId,
      period_year: year,
      period_month: month,
      budget_cents_cap: 5000,
      budget_cents_used: Math.max(0, opts.costCents),
      tokens_input: Math.max(0, opts.tokensInput),
      tokens_output: Math.max(0, opts.tokensOutput),
      tool_calls_count: Math.max(0, opts.toolCalls),
      turns_count: 1,
    });
    return;
  }

  const row = data as {
    id: string;
    budget_cents_used: number;
    tokens_input: number;
    tokens_output: number;
    tool_calls_count: number;
    turns_count: number;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("asistente_usage_monthly") as any)
    .update({
      budget_cents_used: (row.budget_cents_used ?? 0) + Math.max(0, opts.costCents),
      tokens_input: (row.tokens_input ?? 0) + Math.max(0, opts.tokensInput),
      tokens_output: (row.tokens_output ?? 0) + Math.max(0, opts.tokensOutput),
      tool_calls_count: (row.tool_calls_count ?? 0) + Math.max(0, opts.toolCalls),
      turns_count: (row.turns_count ?? 0) + 1,
    })
    .eq("id", row.id);
}

/**
 * Marca warn/block thresholds como notificados (idempotente).
 */
export async function markBudgetThresholdNotified(opts: {
  tenantId: string;
  kind: "warn" | "block";
}) {
  const supabase = getSupabaseAdmin();
  const { year, month } = currentPeriod();
  const column = opts.kind === "warn" ? "warn_sent_at" : "blocked_at";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("asistente_usage_monthly") as any)
    .update({ [column]: new Date().toISOString() })
    .eq("tenant_id", opts.tenantId)
    .eq("period_year", year)
    .eq("period_month", month)
    .is(column, null);
}
