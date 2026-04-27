/**
 * search-utils.ts
 * Accent-insensitive, typo-tolerant text search utilities for booking/customer lookups.
 */

/** Remove accents and convert to lowercase for comparison */
export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip combining marks (accents)
}

/**
 * Score how well `term` matches `target`.
 * Returns a positive number (higher = better match), or 0 if no match.
 *
 * Strategy (in order of priority):
 * 1. Exact match → score 100
 * 2. Starts-with → score 80
 * 3. Word starts-with → score 60 (e.g. "per" matches "Pedro García")
 * 4. Contains → score 40
 * 5. Trigram overlap ≥ 60% → score 20 (handles 1-2 typos on longer words)
 * 6. No match → 0
 */
export function scoreMatch(term: string, target: string): number {
  if (!term || !target) return 0;
  const t = normalizeText(term);
  const h = normalizeText(target);
  if (h === t) return 100;
  if (h.startsWith(t)) return 80;
  const words = h.split(/\s+/);
  if (words.some((w) => w.startsWith(t))) return 60;
  if (h.includes(t)) return 40;
  // Trigram similarity for fuzzy/typo tolerance
  if (t.length >= 3 && trigramSimilarity(t, h) >= 0.45) return 20;
  return 0;
}

/** Build set of 3-character n-grams from a string */
function buildTrigrams(s: string): Set<string> {
  const set = new Set<string>();
  const padded = `  ${s}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

/** Dice coefficient between two strings' trigram sets */
function trigramSimilarity(a: string, b: string): number {
  const tA = buildTrigrams(a);
  const tB = buildTrigrams(b);
  if (tA.size === 0 || tB.size === 0) return 0;
  let shared = 0;
  tA.forEach((g) => { if (tB.has(g)) shared++; });
  return (2 * shared) / (tA.size + tB.size);
}

/** Returns the best match score for `term` against multiple fields */
export function scoreBookingMatch(
  term: string,
  fields: (string | null | undefined)[]
): number {
  if (!term) return 0;
  return Math.max(...fields.map((f) => (f ? scoreMatch(term, f) : 0)));
}
