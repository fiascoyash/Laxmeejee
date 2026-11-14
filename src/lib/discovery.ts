export type DiscoveryFilters = { q: string; city: string; locality: string; category: string; page: number };
export type DirectoryProduct = { name: string; category: string | null; price: number; unit: string | null; in_stock: boolean };
export type DirectoryShop = {
  id: string; slug: string; public_name: string; category: string | null; city: string | null;
  locality: string | null; address: string | null; hours: string | null; tagline: string | null;
  products: DirectoryProduct[];
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