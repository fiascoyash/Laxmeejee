// Customer-side search over the public shop directory: relevance scoring,
// suggestions, Products/Stores/Services grouping and nearby ranking.
import type { DirectoryProduct, DirectoryShop } from './discovery';
import { proximityOf, type CustomerLocation, type Proximity } from './customerLocation';

export type SearchTab = 'all' | 'products' | 'stores' | 'services';
export type ItemHit = { kind: 'product' | 'service'; product: DirectoryProduct; shop: DirectoryShop; score: number; proximity: Proximity };
export type StoreHit = { shop: DirectoryShop; score: number; proximity: Proximity; matchedProductIds: string[] };
export type Suggestion =
  | { type: 'product'; label: string; detail: string }
  | { type: 'category'; label: string; detail: string }
  | { type: 'store'; label: string; detail: string; slug: string };

const STOP_WORDS = new Set(['near', 'me', 'nearby', 'in', 'at', 'the', 'a', 'an', 'for', 'of', 'and', 'shop', 'shops', 'store', 'stores', 'buy', 'wala', 'wali']);
const SERVICE_ITEM = /\b(service|services|servicing|repair|repairs|repairing|installation|install|fitting|consultation|consult|session|visit|appointment|booking|haircut|facial|massage|spa|tuition|class|classes|coaching|cleaning|wash|washing|labour|labor|checkup|treatment|stitching|alteration|rental|rent)\b/;
const SERVICE_UNIT = /\b(service|session|visit|hour|hr|hrs|job|appointment|class|month)\b/;
const SERVICE_SHOP = /\b(salon|parlour|parlor|beauty|spa|repair|service|services|clinic|doctor|dental|tuition|coaching|tailor|laundry|dry clean|electrician|plumber|carpenter|studio|gym|fitness|consultant|travel|courier|photocopy|cyber)\b/;

export function normalizeText(value: string | null | undefined) {
  return (value ?? '').toLocaleLowerCase('en-IN').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const stem = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (value: string | null | undefined) => normalizeText(value).split(' ').filter(Boolean).map(stem);

export function queryTokens(query: string) {
  const all = words(query);
  const meaningful = all.filter(t => !STOP_WORDS.has(t));
  return meaningful.length ? meaningful : all;
}

function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? max + 1;
}

/** 1 = exact word, 0.8 = word starts with the token, 0.55 = small typo, 0 = no match. */
function tokenQuality(token: string, fieldWords: string[]) {
  let best = 0;
  for (const w of fieldWords) {
    if (w === token) return 1;
    if (w.startsWith(token)) best = Math.max(best, 0.8);
    else if (token.length >= 5 && w[0] === token[0]) {
      // Small typo tolerance ("paracitamol"), also for a partly typed longer word.
      const allowed = token.length >= 8 ? 2 : 1;
      if (editDistance(token, w, allowed) <= allowed) best = Math.max(best, 0.55);
      else if (token.length >= 6 && w.length > token.length && editDistance(token, w.slice(0, token.length), 1) <= 1) best = Math.max(best, 0.5);
    }
  }
  return best;
}

type Field = { words: string[]; weight: number; primary: boolean };

/** Every token must match some field and at least one must hit a primary field; returns 0 otherwise. */
function scoreFields(tokens: string[], fields: Field[]) {
  if (!tokens.length) return 0;
  let total = 0;
  let primaryHit = false;
  for (const t of tokens) {
    let best = 0;
    for (const f of fields) {
      const q = tokenQuality(t, f.words) * f.weight;
      if (q > best) best = q;
      if (q > 0 && f.primary) primaryHit = true;
    }
    if (best === 0) return 0;
    total += best;
  }
  return primaryHit ? total / tokens.length : 0;
}

export const isServiceProduct = (p: DirectoryProduct) => SERVICE_ITEM.test(normalizeText(`${p.name} ${p.category ?? ''}`)) || SERVICE_UNIT.test(normalizeText(p.unit));
export const isServiceShop = (shop: DirectoryShop) => SERVICE_SHOP.test(normalizeText(shop.category));

const proximityPenalty = (p: Proximity) => Math.min(30, p.rank * 3);

export function searchCatalog(shops: DirectoryShop[], query: string, location: CustomerLocation | null) {
  const tokens = queryTokens(query);
  const phrase = normalizeText(query);
  const products: ItemHit[] = [];
  const services: ItemHit[] = [];
  const stores: StoreHit[] = [];
  if (!tokens.length) return { products, services, stores };
  for (const shop of shops) {
    const proximity = proximityOf(shop, location);
    const place: Field = { words: words(`${shop.locality ?? ''} ${shop.city ?? ''}`), weight: 12, primary: false };
    const shopName = words(shop.public_name);
    const shopCategory = words(shop.category);
    const matched: string[] = [];
    let bestProduct = 0;
    for (const product of shop.products) {
      const name = normalizeText(product.name);
      let score = scoreFields(tokens, [
        { words: words(product.name), weight: 100, primary: true },
        { words: words(product.category), weight: 55, primary: true },
        { words: shopName, weight: 15, primary: false },
        { words: shopCategory, weight: 15, primary: false },
        place,
      ]);
      if (!score) continue;
      if (name === phrase) score += 40; else if (name.startsWith(phrase)) score += 25; else if (name.includes(phrase)) score += 12;
      if (product.in_stock) score += 5;
      matched.push(product.product_id);
      bestProduct = Math.max(bestProduct, score);
      (isServiceProduct(product) ? services : products).push({ kind: isServiceProduct(product) ? 'service' : 'product', product, shop, score: score - proximityPenalty(proximity), proximity });
    }
    let shopScore = scoreFields(tokens, [
      { words: shopName, weight: 100, primary: true },
      { words: shopCategory, weight: 60, primary: true },
      { words: words(shop.tagline), weight: 25, primary: true },
      { ...place, weight: 30, primary: true },
    ]);
    const nameText = normalizeText(shop.public_name);
    if (shopScore && nameText === phrase) shopScore += 40; else if (shopScore && nameText.startsWith(phrase)) shopScore += 20;
    if (bestProduct) shopScore = Math.max(shopScore, bestProduct * 0.7) + Math.min(10, matched.length * 2);
    if (shopScore) stores.push({ shop, score: shopScore - proximityPenalty(proximity), proximity, matchedProductIds: matched });
  }
  const byScore = (a: { score: number; proximity: Proximity }, b: { score: number; proximity: Proximity }) => b.score - a.score || a.proximity.rank - b.proximity.rank;
  products.sort(byScore); services.sort(byScore); stores.sort(byScore);
  return { products, services, stores };
}

/** Shops ordered nearest first (alphabetical when no location is set). */
export function rankNearby(shops: DirectoryShop[], location: CustomerLocation | null): StoreHit[] {
  return shops
    .map(shop => ({ shop, score: 0, proximity: proximityOf(shop, location), matchedProductIds: [] as string[] }))
    .sort((a, b) => a.proximity.rank - b.proximity.rank || a.shop.public_name.localeCompare(b.shop.public_name));
}

export function popularCategories(shops: DirectoryShop[], limit = 8) {
  const counts = new Map<string, { label: string; n: number }>();
  const add = (value: string | null, n: number) => {
    const key = normalizeText(value);
    if (!key || !value) return;
    const cur = counts.get(key);
    counts.set(key, { label: cur?.label ?? value.trim(), n: (cur?.n ?? 0) + n });
  };
  for (const shop of shops) { add(shop.category, 3); for (const p of shop.products) add(p.category, 1); }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, limit).map(c => c.label);
}

export function suggest(shops: DirectoryShop[], query: string, limit = 8): Suggestion[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const products = new Map<string, { label: string; shops: Set<string>; score: number; shopName: string }>();
  const categories = new Map<string, { label: string; score: number }>();
  const stores: (Suggestion & { score: number })[] = [];
  for (const shop of shops) {
    for (const p of shop.products) {
      const s = scoreFields(tokens, [{ words: words(p.name), weight: 100, primary: true }]);
      if (s) {
        const key = normalizeText(p.name);
        const cur = products.get(key) ?? { label: p.name.trim(), shops: new Set<string>(), score: s, shopName: shop.public_name };
        cur.shops.add(shop.id); cur.score = Math.max(cur.score, s);
        products.set(key, cur);
      }
      if (p.category) {
        const c = scoreFields(tokens, [{ words: words(p.category), weight: 80, primary: true }]);
        if (c && !categories.has(normalizeText(p.category))) categories.set(normalizeText(p.category), { label: p.category.trim(), score: c });
      }
    }
    if (shop.category) {
      const c = scoreFields(tokens, [{ words: words(shop.category), weight: 90, primary: true }]);
      if (c) categories.set(normalizeText(shop.category), { label: shop.category.trim(), score: Math.max(c, categories.get(normalizeText(shop.category))?.score ?? 0) });
    }
    const s = scoreFields(tokens, [{ words: words(shop.public_name), weight: 100, primary: true }]);
    if (s) stores.push({ type: 'store', label: shop.public_name, detail: [shop.locality, shop.city].filter(Boolean).join(', ') || shop.category || 'Local shop', slug: shop.slug, score: s });
  }
  const productList: (Suggestion & { score: number })[] = [...products.values()].map(p => ({ type: 'product', label: p.label, detail: p.shops.size > 1 ? `at ${p.shops.size} shops` : `at ${p.shopName}`, score: p.score + p.shops.size }));
  const categoryList: (Suggestion & { score: number })[] = [...categories.values()].map(c => ({ type: 'category', label: c.label, detail: 'Category', score: c.score }));
  const top = (list: (Suggestion & { score: number })[], n: number) => list.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, n);
  const picked = [...top(productList, 4), ...top(stores, 3), ...top(categoryList, 2)];
  return picked.slice(0, limit).map(({ score: _score, ...s }) => s as Suggestion);
}
