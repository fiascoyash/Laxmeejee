import type {
  ProductCatalogItem,
  ProductMatchCandidate,
  MatchConfidenceLevel,
} from '../types';

// ─── Product matching engine ───────────────────────────────────────────────
// Given an imported product name, find the best matches in the catalog. We
// combine token-based Jaccard similarity with a substring bonus so that
// "PCM 650" matches "Paracetamol 650mg" with a high score. The score is
// 0-100 and bucketed into high/medium/low/none for the UI badge.

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenize = (s: string): string[] => {
  const n = normalize(s);
  if (!n) return [];
  return n.split(' ').filter((t) => t.length > 0);
};

// Jaccard similarity over token sets, plus a bonus when one name contains the
// other as a substring. Caps at 100.
const nameSimilarity = (a: string, b: string): number => {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Substring bonus: if the normalized full name of one is contained in the
  // other, the tokens are likely a prefix/abbreviation of the same product.
  const na = normalize(a);
  const nb = normalize(b);
  let bonus = 0;
  if (na && nb) {
    if (na.includes(nb) || nb.includes(na)) bonus = 0.15;
    // Shared numeric token (e.g. "650") is a strong signal for medicine /
    // electronics where the strength matters.
    const numsA = Array.from(ta).filter((t) => /^[0-9]+$/.test(t));
    const numsB = Array.from(tb).filter((t) => /^[0-9]+$/.test(t));
    if (numsA.length && numsB.length && numsA.some((n) => numsB.includes(n))) bonus += 0.1;
  }
  return Math.min(1, jaccard + bonus);
};

const levelFor = (score: number): MatchConfidenceLevel => {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.35) return 'low';
  return 'none';
};

// Returns ranked candidates (highest score first). We cap the list at 5 so the
// UI stays readable even for large catalogs.
export const findMatchCandidates = (
  importedName: string,
  catalog: ProductCatalogItem[],
  limit = 5
): ProductMatchCandidate[] => {
  if (!importedName.trim()) return [];
  const scored = catalog
    .map((product) => {
      const score = nameSimilarity(importedName, product.name);
      return { product, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({
      product: c.product,
      score: Math.round(c.score * 100),
      level: levelFor(c.score),
    }));
  return scored;
};

// Convenience: the single best candidate, or null when nothing scores above
// the "low" threshold. Used to pre-select a match in the preview.
export const bestCandidate = (
  importedName: string,
  catalog: ProductCatalogItem[]
): ProductMatchCandidate | null => {
  const candidates = findMatchCandidates(importedName, catalog, 1);
  if (candidates.length === 0) return null;
  const top = candidates[0];
  return top.level === 'none' ? null : top;
};
