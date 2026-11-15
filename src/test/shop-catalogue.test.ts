import { describe, expect, it } from 'vitest';
import { catalogueRows, directionsUrl, filterShopProducts, validMapsUrl } from '@/lib/shop-catalogue';
import { storage } from '@/legacy/utils/storage';

describe('Shop catalogue', () => {
  it('publishes the same default catalogue billing shows before a local key exists', () => {
    localStorage.removeItem('solar_product_catalog');
    const products = storage.getProductCatalog();
    expect(products.length).toBeGreaterThan(0);
    const rows = catalogueRows('shop-1', products, new Set(products.map(p => p.id)));
    expect(rows.map(p => p.name)).toEqual(products.map(p => p.name));
    expect(rows[0]?.price).toBe(products[0]?.sellingPrice);
  });
  it('publishes selected products and includes optional photo references only when supported', () => {
    const product = { ...storage.getProductCatalog()[0], id: 'panel', imagePath: 'owner/panel.jpg', stockQuantity: 3, sellingPrice: 1250 };
    expect(catalogueRows('shop-1', [product], new Set())).toEqual([]);
    const row = catalogueRows('shop-1', [product], new Set(['panel']), true)[0];
    expect(row).toMatchObject({ business_id: 'shop-1', product_id: 'panel', price: 1250, in_stock: true, image_path: 'owner/panel.jpg' });
    expect(catalogueRows('shop-1', [product], new Set(['panel']))[0]).not.toHaveProperty('image_path');
  });
  it('combines customer category selection and case-insensitive product search', () => {
    const products = [{ name: 'Waaree Panel', category: 'Solar', description: '550W' }, { name: 'LED Panel', category: 'Lighting', description: null }];
    expect(filterShopProducts(products, 'PANEL', 'Solar')).toEqual([products[0]]);
    expect(filterShopProducts(products, '550w', '')).toEqual([products[0]]);
    expect(filterShopProducts(products, 'battery', '')).toEqual([]);
  });
  it('uses a saved Google Maps location or address-based directions', () => {
    const shop = { public_name: 'Lights', address: 'Main Road', locality: null, city: 'Bijnor', maps_url: 'https://maps.app.goo.gl/abc' };
    expect(directionsUrl(shop)).toBe('https://maps.app.goo.gl/abc');
    expect(directionsUrl({ ...shop, maps_url: null })).toBe('https://www.google.com/maps/dir/?api=1&destination=Lights%2C%20Main%20Road%2C%20Bijnor');
    expect(directionsUrl({ ...shop, maps_url: null, address: null })).toBeNull();
  });
  it('rejects non-Google and unsafe location links', () => {
    expect(validMapsUrl('javascript:alert(1)')).toBeNull();
    expect(validMapsUrl('https://google.com.evil.example/maps')).toBeNull();
    expect(validMapsUrl('https://www.google.com/maps/search/?api=1&query=29,78')).toBe('https://www.google.com/maps/search/?api=1&query=29,78');
  });
});