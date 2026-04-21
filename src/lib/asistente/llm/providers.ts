/**
 * Abstracción de proveedores LLM.
 *
 * Objetivo: poder cambiar de Mistral a Anthropic (o cualquier otro futuro)
 * sin tocar el resto del código. Solo el nombre del modelo y la API key
 * cambian via env vars.
 *
 * Variables de entorno:
 *   ASISTENTE_LLM_PROVIDER   → 'mistral' (default) | 'anthropic'
 *   ASISTENTE_LLM_MODEL      → id del modelo (depende del proveedor)
 *   MISTRAL_API_KEY          → requerida si provider=mistral
 *   ANTHROPIC_API_KEY        → requerida si provider=anthropic
 *
 * Precios (céntimos de euro por millón de tokens, tarifas público Apr 2026).
 * Si cambian, actualizar aquí; se usa para el tracking de coste real.
 */

import { mistral, createMistral } from "@ai-sdk/mistral";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type LlmProviderId = "mistral" | "anthropic";

export interface ModelPricing {
  /** Céntimos de euro por millón de tokens de entrada. */
  inputPerMillion: number;
  /** Céntimos de euro por millón de tokens de salida. */
  outputPerMillion: number;
  /** Céntimos por millón cuando hay prompt caching (read). null si no soporta. */
  cacheReadPerMillion?: number | null;
}

export interface ResolvedLlmConfig {
  provider: LlmProviderId;
  modelId: string;
  pricing: ModelPricing;
  /**
   * Instancia LanguageModel lista para pasar a streamText/generateText.
   * Se construye lazy — una vez y se cachea.
   */
  model: LanguageModel;
}

/**
 * Tarifas conocidas. Valores en céntimos de euro (= cents) por millón.
 * Convertimos $ → € usando ~0.92 de margen (los números son aproximados
 * pero conservadores: preferimos sobreestimar coste y no pasarnos de
 * presupuesto).
 *
 * Fuentes oficiales:
 *   Mistral:   https://mistral.ai/technology#pricing
 *   Anthropic: https://www.anthropic.com/pricing#anthropic-api
 */
const KNOWN_PRICING: Record<string, ModelPricing> = {
  // Mistral
  "mistral-large-latest":   { inputPerMillion: 184, outputPerMillion: 552,  cacheReadPerMillion: null }, // ~2€ / 6€
  "mistral-medium-latest":  { inputPerMillion: 37,  outputPerMillion: 184,  cacheReadPerMillion: null }, // ~0.4 / 2
  "mistral-small-latest":   { inputPerMillion: 9,   outputPerMillion: 28,   cacheReadPerMillion: null }, // ~0.1 / 0.3
  "open-mistral-nemo":      { inputPerMillion: 14,  outputPerMillion: 14,   cacheReadPerMillion: null }, // ~0.15 / 0.15
  // Anthropic (céntimos de euro)
  "claude-sonnet-4-6":      { inputPerMillion: 276, outputPerMillion: 1380, cacheReadPerMillion: 28 },  // ~3 / 15, cache 0.3
  "claude-haiku-4-5":       { inputPerMillion: 92,  outputPerMillion: 460,  cacheReadPerMillion: 9 },   // ~1 / 5, cache 0.1
  "claude-opus-4-6":        { inputPerMillion: 1380, outputPerMillion: 6900, cacheReadPerMillion: 138 }, // ~15 / 75
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 184,
  outputPerMillion: 552,
  cacheReadPerMillion: null,
};

/** Valida el provider de env y cae a 'mistral' si es desconocido. */
function readProviderId(): LlmProviderId {
  const raw = (process.env.ASISTENTE_LLM_PROVIDER ?? "mistral").toLowerCase();
  if (raw === "anthropic") return "anthropic";
  return "mistral";
}

function readModelId(provider: LlmProviderId): string {
  const raw = process.env.ASISTENTE_LLM_MODEL?.trim();
  if (raw) return raw;
  return provider === "anthropic" ? "claude-haiku-4-5" : "mistral-large-latest";
}

let _cache: ResolvedLlmConfig | null = null;

/**
 * Resuelve la configuración activa del LLM. Lazy + cached.
 * Llamar desde cualquier parte del backend — no hace I/O, solo valida env.
 */
export function resolveLlmConfig(): ResolvedLlmConfig {
  if (_cache) return _cache;

  const provider = readProviderId();
  const modelId = readModelId(provider);
  const pricing = KNOWN_PRICING[modelId] ?? DEFAULT_PRICING;

  let model: LanguageModel;
  if (provider === "mistral") {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      // En dev permitimos fallar lazy; el endpoint devolverá 503 si se usa.
      throw new Error(
        "[asistente] MISTRAL_API_KEY no configurada. Añádela a las env vars del deploy.",
      );
    }
    const m = createMistral({ apiKey });
    model = m(modelId);
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "[asistente] ANTHROPIC_API_KEY no configurada. Añádela a las env vars del deploy.",
      );
    }
    const a = createAnthropic({ apiKey });
    model = a(modelId);
  }

  _cache = { provider, modelId, pricing, model };
  return _cache;
}

/** Solo en tests: resetea el caché singleton para cambiar env y re-resolver. */
export function _resetLlmConfigCacheForTests(): void {
  _cache = null;
}

/**
 * Calcula coste en céntimos (con decimales) para un uso dado.
 * Si hay cacheReadTokens, los pagamos a la tarifa de cache (más barata).
 */
export function computeCostCents(params: {
  pricing: ModelPricing;
  tokensInput: number;
  tokensOutput: number;
  cacheReadTokens?: number;
}): number {
  const { pricing, tokensInput, tokensOutput, cacheReadTokens = 0 } = params;
  const inputPaid = Math.max(0, tokensInput - cacheReadTokens);
  const cached = Math.max(0, cacheReadTokens);

  const inputCost = (inputPaid * pricing.inputPerMillion) / 1_000_000;
  const cacheCost = pricing.cacheReadPerMillion
    ? (cached * pricing.cacheReadPerMillion) / 1_000_000
    : 0;
  const outputCost = (tokensOutput * pricing.outputPerMillion) / 1_000_000;

  // Redondeamos a 4 decimales → sub-céntimo.
  return Math.round((inputCost + cacheCost + outputCost) * 10000) / 10000;
}

// Silenciar eslint: importamos mistral/anthropic singletons solo para tree-shaking
// awareness; los usos reales van vía createMistral/createAnthropic arriba.
export const __unused_but_referenced = { mistral, anthropic };
