import { describe, expect, it } from 'vitest';
import type { DirectoryShop } from '@/lib/discovery';
import { makeLocation } from '@/lib/customerLocation';
import { popularCategories, rankNearby, searchCatalog, suggest } from '@/lib/localSearch';

const shop = (id: string, over: Partial<DirectoryShop>): DirectoryShop => ({ id, slug: id, public_name: id, category: null, city: 'Bijnor', locality: null, address: null, hours: null, tagline: null, products: [], ...over });
const shops: DirectoryShop[] = [
  shop('lights', { public_name: 'Kumar Lights', category: 'Electricals', locality: 'Main Bazar', products: [
    { product_id: 'bulb', name: 'LED Bulb 9W', category: 'Lighting', price: 100, unit: 'pcs', in_stock: true },
    { product_id: 'wire', name: 'Copper Wire', category: 'Hardware', price: 900, unit: 'roll', in_stock: true },
    { product_id: 'fit', name: 'Fan installation', category: null, price: 250, unit: 'visit', in_stock: true },
  ] }),
  shop('hardware', { public_name: 'Sharma Hardware', category: 'Hardware', locality: 'Civil Lines', address: 'Near Clock Tower, Bijnor 246701', products: [
    { product_id: 'nail', name: 'Steel Nails', category: 'Hardware', price: 60, unit: 'kg', in_stock: true },
  ] }),
  shop('chemist', { public_name: 'Health Plus Chemist', category: 'Pharmacy', city: 'Delhi', locality: 'Market Road', products: [
    { product_id: 'para', name: 'Paracetamol 500mg', category: 'Medicine', price: 30, unit: 'strip', in_stock: true },
  ] }),
];

describe('Homepage search relevance', () => {
  it('shows no unrelated shops when nothing matches the query', () => {
    const r = searchCatalog(shops.filter(s => s.id !== 'chemist'), 'Paracetamol', null);
    expect(r.products).toEqual([]);
    expect(r.stores).toEqual([]);
    expect(r.services).toEqual([]);
  });
  it('finds a medicine and its shop when a shop lists it', () => {
    const r = searchCatalog(shops, 'paracetamol', null);
    expect(r.products.map(h => h.product.product_id)).toEqual(['para']);
    expect(r.stores.map(h => h.shop.id)).toEqual(['chemist']);
  });
  it('tolerates a one-letter typo', () => expect(searchCatalog(shops, 'paracitamol', null).products.map(h => h.product.product_id)).toEqual(['para']));
  it('matches shop names, categories and product words', () => {
    expect(searchCatalog(shops, 'sharma', null).stores.map(h => h.shop.id)).toEqual(['hardware']);
    expect(searchCatalog(shops, 'led bulbs', null).products.map(h => h.product.product_id)).toEqual(['bulb']);
    expect(searchCatalog(shops, 'pharmacy', null).stores.map(h => h.shop.id)).toEqual(['chemist']);
  });
  it('puts services in the Services group', () => {
    const r = searchCatalog(shops, 'fan installation', null);
    expect(r.services.map(h => h.product.product_id)).toEqual(['fit']);
    expect(r.products).toEqual([]);
  });
  it('ranks the shop in the customer’s area first for the same match', () => {
    const near = makeLocation({ city: 'Bijnor', locality: 'Civil Lines' }, 'manual');
    expect(searchCatalog(shops, 'hardware', near).stores[0]?.shop.id).toBe('hardware');
    expect(searchCatalog(shops, 'hardware', makeLocation({ locality: 'Main Bazar' }, 'manual')).products[0]?.shop.id).toBe('lights');
  });
});

describe('Nearby shops and suggestions', () => {
  it('orders shops by pincode, then locality, then city', () => {
    const loc = makeLocation({ city: 'Bijnor', locality: 'Main Bazar', pincode: '246701' }, 'manual');
    expect(rankNearby(shops, loc).map(h => [h.shop.id, h.proximity.tier])).toEqual([['hardware', 'pincode'], ['lights', 'locality'], ['chemist', 'none']]);
  });
  it('orders shops alphabetically when no location is set', () => expect(rankNearby(shops, null).map(h => h.shop.id)).toEqual(['chemist', 'lights', 'hardware']));
  it('suggests products, shops and categories while typing', () => {
    const s = suggest(shops, 'har');
    expect(s.some(x => x.type === 'store' && x.label === 'Sharma Hardware')).toBe(true);
    expect(s.some(x => x.type === 'category' && x.label === 'Hardware')).toBe(true);
    expect(suggest(shops, 'zzz')).toEqual([]);
  });
  it('lists the most common categories as quick chips', () => expect(popularCategories(shops, 2)).toEqual(['Hardware', 'Electricals']));
});
