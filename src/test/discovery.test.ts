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