import type { ProductCatalogItem } from '@/legacy/types';

export function catalogueRows(businessId: string, catalog: ProductCatalogItem[], selected: Set<string>, photosEnabled = false) {
  return catalog.filter(p => selected.has(p.id)).map(p => ({
    business_id: businessId, product_id: p.id, name: p.name,
    category: p.category?.trim() || null, unit: p.unit || null,
    price: Number(p.sellingPrice) || 0, description: p.description || null,
    in_stock: Number(p.stockQuantity) > 0,
    ...(photosEnabled ? { image_path: p.imagePath || null } : {}),
    updated_at: new Date().toISOString(),
  }));
}

export type SearchableProduct = { name: string; category: string | null; description: string | null };
export function filterShopProducts<T extends SearchableProduct>(products: T[], query: string, category: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return products.filter(p => (!category || (p.category?.trim() || 'Other') === category) &&
    words.every(word => [p.name, p.category, p.description].filter(Boolean).join(' ').toLocaleLowerCase().includes(word)));
}

export function validMapsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps')) ||
      ((host === 'google.com' || host === 'www.google.com' || host === 'maps.google.com' || host === 'google.co.in' || host === 'www.google.co.in') && (url.pathname.startsWith('/maps') || host === 'maps.google.com'))) return url.href;
  } catch { /* Invalid link. */ }
  return null;
}

export function directionsUrl(shop: { maps_url?: string | null; address: string | null; locality: string | null; city: string | null; public_name: string }) {
  const saved = shop.maps_url ? validMapsUrl(shop.maps_url) : null;
  if (saved) return saved;
  if (!shop.address?.trim()) return null;
  const destination = [shop.public_name, shop.address, shop.locality, shop.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}