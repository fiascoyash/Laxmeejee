export type DiscoveryFilters = { q: string; city: string; locality: string; category: string; page: number };
export type DirectoryProduct = { product_id?: string; image_path?: string | null; name: string; category: string | null; price: number; unit: string | null; in_stock: boolean };
export type DirectoryShop = {
  id: string; slug: string; public_name: string; category: string | null; city: string | null;
  locality: string | null; address: string | null; hours: string | null; tagline: string | null; phone?: string | null;
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
export type Suggestion =
  | { kind: 'product'; label: string; shops: number; minPrice: number }
  | { kind: 'shop'; label: string; slug: string; locality: string | null; city: string | null; category: string | null }
  | { kind: 'category'; label: string; shops: number };

/** Only shops with at least one listed product appear to customers. */
export function listedShops(shops: DirectoryShop[]) {
  return shops.filter(shop => shop.products.length > 0);
}

/** Products in a shop matching every search term, best (exact-name, in-stock, cheapest) first. */
export function matchingProducts(shop: DirectoryShop, q: string) {
  const terms = normalized(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const needle = normalized(q);
  return shop.products
    .filter(p => { const hay = normalized(`${p.name} ${p.category ?? ''}`); return terms.every(t => hay.includes(t)); })
    .sort((a, b) => Number(normalized(b.name) === needle) - Number(normalized(a.name) === needle) || Number(b.in_stock) - Number(a.in_stock) || a.price - b.price);
}

export function buildSuggestions(shops: DirectoryShop[], q: string, limit = 5): Suggestion[] {
  const needle = normalized(q);
  if (needle.length < 2) return [];
  const products = new Map<string, { label: string; shops: Set<string>; minPrice: number }>();
  const categories = new Map<string, { label: string; shops: Set<string> }>();
  const shopHits: Suggestion[] = [];
  for (const shop of listedShops(shops)) {
    if (normalized(shop.public_name).includes(needle)) shopHits.push({ kind: 'shop', label: shop.public_name, slug: shop.slug, locality: shop.locality, city: shop.city, category: shop.category });
    for (const p of shop.products) {
      if (normalized(p.name).includes(needle)) {
        const key = normalized(p.name);
        const entry = products.get(key) ?? { label: p.name.trim(), shops: new Set(), minPrice: Infinity };
        entry.shops.add(shop.id); entry.minPrice = Math.min(entry.minPrice, Number(p.price));
        products.set(key, entry);
      }
    }
    for (const c of [shop.category, ...shop.products.map(p => p.category)]) {
      if (c && normalized(c).includes(needle)) {
        const entry = categories.get(normalized(c)) ?? { label: c.trim(), shops: new Set() };
        entry.shops.add(shop.id); categories.set(normalized(c), entry);
      }
    }
  }
  const starts = (s: string) => Number(normalized(s).startsWith(needle));
  return [
    ...[...products.values()].sort((a, b) => starts(b.label) - starts(a.label) || b.shops.size - a.shops.size).slice(0, limit)
      .map(p => ({ kind: 'product' as const, label: p.label, shops: p.shops.size, minPrice: p.minPrice })),
    ...shopHits.sort((a, b) => starts(b.label) - starts(a.label)).slice(0, limit),
    ...[...categories.values()].sort((a, b) => b.shops.size - a.shops.size).slice(0, limit)
      .map(c => ({ kind: 'category' as const, label: c.label, shops: c.shops.size })),
  ];
}
