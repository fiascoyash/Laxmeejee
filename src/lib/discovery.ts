export type DiscoveryFilters = { q: string; city: string; locality: string; category: string; page: number };
export type DirectoryProduct = { product_id: string; name: string; category: string | null; price: number; unit: string | null; in_stock: boolean };
export type DirectoryShop = {
  id: string; slug: string; public_name: string; category: string | null; city: string | null;
  locality: string | null; address: string | null; hours: string | null; tagline: string | null;
  latitude?: number; longitude?: number;
  products: DirectoryProduct[];
  response?: ResponseStats | null;
};
const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 100) : '';
const normalized = (value: string | null) => (value ?? '').trim().toLocaleLowerCase('en-IN');

export function normalizeDiscovery(input: Record<string, unknown>): DiscoveryFilters {
  return { q: text(input['q']), city: text(input['city']), locality: text(input['locality']), category: text(input['category']), page: Math.max(1, Math.min(10000, Math.floor(Number(input['page']) || 1))) };
}

export function filterDirectory(shops: DirectoryShop[], filters: DiscoveryFilters) {
  const terms = normalized(filters.q).split(/\s+/).filter(Boolean);
  return shops.filter(shop => {
    if (filters.city && normalized(shop.city) !== normalized(filters.city)) return false;
    if (filters.locality && normalized(shop.locality) !== normalized(filters.locality)) return false;
    if (filters.category && normalized(shop.category) !== normalized(filters.category)) return false;
    const haystack = normalized([shop.public_name, shop.category, shop.city, shop.locality, shop.tagline, ...shop.products.map(p => `${p.name} ${p.category ?? ''}`)].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}

export function directoryOptions(values: (string | null)[]) {
  const unique = new Map<string, string>();
  for (const value of values) if (value?.trim()) unique.set(normalized(value), value.trim());
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}
export type ResponseStats = { responded: number; avg_minutes: number; quick_share: number };
/** Shops have 15 minutes to answer a new pickup order; faster, consistent replies earn a higher rating. */
export const RESPONSE_WINDOW_MINUTES = 15;
export function responseRating(stats?: ResponseStats | null) {
  if (!stats || stats.responded < 3) return null;
  const m = Number(stats.avg_minutes);
  let score = m <= 5 ? 5 : m <= 10 ? 4.5 : m <= 15 ? 4 : m <= 30 ? 3.5 : m <= 60 ? 3 : 2.5;
  if (Number(stats.quick_share) < 0.5) score -= 0.5;
  score = Math.max(1, score);
  const time = m < 1 ? 'under a minute' : m < 60 ? `~${Math.round(m)} min` : `~${Math.round(m / 60)} hr`;
  return { score, label: score >= 4.5 ? 'Super quick' : score >= 4 ? 'Quick to respond' : score >= 3 ? 'Responds' : 'Slow to respond', time, orders: stats.responded };
}
