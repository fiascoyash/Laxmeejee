import { describe, expect, it } from 'vitest';
import { directoryOptions, filterDirectory, normalizeDiscovery, type DirectoryShop } from '@/lib/discovery';

const shops: DirectoryShop[] = [
  { id: 'a', slug: 'lights', public_name: 'Kumar Lights', category: 'Electricals', city: 'Bijnor', locality: 'Main Bazar', address: null, hours: null, tagline: null, products: [{ name: 'LED Bulb', category: null, price: 100, unit: 'pcs', in_stock: true }] },
  { id: 'b', slug: 'medicine', public_name: 'Health Store', category: 'Pharmacy', city: 'Delhi', locality: 'Market Road', address: null, hours: null, tagline: null, products: [{ name: 'Tablets', category: null, price: 50, unit: 'strip', in_stock: false }] },
];
describe('Local discovery', () => {
  it('finds a shop by name without case sensitivity', () => expect(filterDirectory(shops, normalizeDiscovery({ q: 'KUMAR' })).map(s => s.id)).toEqual(['a']));
  it('finds the merchant carrying a searched product', () => expect(filterDirectory(shops, normalizeDiscovery({ q: 'led bulb' })).map(s => s.id)).toEqual(['a']));
  it('combines city, locality and category filters', () => {
    expect(filterDirectory(shops, normalizeDiscovery({ city: 'bijnor', locality: 'MAIN BAZAR', category: 'Electricals' })).map(s => s.id)).toEqual(['a']);
    expect(filterDirectory(shops, normalizeDiscovery({ city: 'Bijnor', category: 'Pharmacy' }))).toEqual([]);
  });
  it('returns no match for an unknown product', () => expect(filterDirectory(shops, normalizeDiscovery({ q: 'cement' }))).toEqual([]));
  it('deduplicates city names ignoring whitespace and case', () => expect(directoryOptions(['Bijnor', ' bijnor ', null, 'Delhi'])).toHaveLength(2));
  it('bounds malformed search and pagination inputs', () => {
    expect(normalizeDiscovery({ page: -5, q: ['x'] })).toEqual({ q: '', city: '', locality: '', category: '', page: 1 });
    expect(normalizeDiscovery({ page: Infinity }).page).toBe(10000);
  });
});
import { buildSuggestions, listedShops, matchingProducts } from '@/lib/discovery';
describe('Product-first discovery', () => {
  const empty: DirectoryShop = { ...shops[0]!, id: 'c', slug: 'new', public_name: 'Kumar New Shop', products: [] };
  const rival: DirectoryShop = { ...shops[0]!, id: 'd', slug: 'abc', public_name: 'ABC Electricals', products: [{ name: 'LED Bulb', category: null, price: 90, unit: 'pcs', in_stock: true }] };
  it('hides newly registered shops that list no products', () => expect(listedShops([...shops, empty]).map(s => s.id)).toEqual(['a', 'b']));
  it('suggests a product with its shop count and lowest price', () => {
    expect(buildSuggestions([...shops, rival], 'led')).toContainEqual({ kind: 'product', label: 'LED Bulb', shops: 2, minPrice: 90 });
  });
  it('suggests shops by name but never empty ones', () => {
    const s = buildSuggestions([...shops, empty], 'kumar');
    expect(s.filter(x => x.kind === 'shop').map(x => x.label)).toEqual(['Kumar Lights']);
  });
  it('needs at least 2 characters before suggesting', () => expect(buildSuggestions(shops, 'l')).toEqual([]));
  it('finds the matching product inside a shop', () => expect(matchingProducts(shops[0]!, 'led')[0]?.name).toBe('LED Bulb'));
});
