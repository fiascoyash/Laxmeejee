import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db-types';
import { buildSuggestions, directoryOptions, filterDirectory, listedShops, matchingProducts, normalizeDiscovery, type DirectoryShop, type DirectoryProduct } from './discovery';

async function loadDirectory(): Promise<DirectoryShop[]> {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env['SUPABASE_URL'] || import.meta.env["VITE_SUPABASE_URL"];
  if (!key || !url) throw new Error('Shop search is unavailable. Please try again.');
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
  const shops: DirectoryShop[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('businesses')
      .select('id, slug, public_name, category, city, locality, address, hours, tagline, phone')
      .eq('is_published', true).order('public_name').order('id').range(offset, offset + 499);
    // PGRST205 / 42P01: shop tables not created yet — show an empty directory.
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) break;
    if (error) throw new Error('Could not load shops. Please try again.');
    shops.push(...(data ?? []).map(shop => ({ ...shop, products: [] })));
    if (!data || data.length < 500) break;
  }
  const byId = new Map(shops.map(shop => [shop.id, shop]));
  // Anonymous RLS permits only products belonging to published shops.
  let columns = 'business_id, product_id, name, category, price, unit, in_stock, image_path';
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('shop_products')
      .select(columns).order('business_id').order('product_id').range(offset, offset + 499);
    if (error && (error.code === 'PGRST205' || error.code === '42P01')) break;
    // Photo column is optional; retry without it.
    if (error && error.code === '42703' && columns.includes('image_path')) { columns = 'business_id, product_id, name, category, price, unit, in_stock'; offset -= 500; continue; }
    if (error) throw new Error('Could not load products. Please try again.');
    const rows = (data ?? []) as unknown as (DirectoryProduct & { business_id: string })[];
    for (const { business_id, ...product } of rows) byId.get(business_id)?.products.push(product);
    if (!data || data.length < 500) break;
  }
  return listedShops(shops);
}

export const searchDirectory = createServerFn({ method: 'GET' })
  .inputValidator((input: Record<string, unknown>) => normalizeDiscovery(input))
  .handler(async ({ data: filters }) => {
    const shops = await loadDirectory();
    const results = filterDirectory(shops, filters)
      .map(shop => ({ shop, best: matchingProducts(shop, filters.q)[0] }))
      // Shops actually listing the product first, then cheapest in-stock price.
      .sort((a, b) => Number(Boolean(b.best)) - Number(Boolean(a.best)) || Number(b.best?.in_stock ?? 0) - Number(a.best?.in_stock ?? 0) || (a.best?.price ?? 0) - (b.best?.price ?? 0))
      .map(({ shop }) => shop);
    const productShops = filters.q ? results.filter(s => matchingProducts(s, filters.q).length > 0).length : 0;
    const pages = Math.max(1, Math.ceil(results.length / 12));
    const page = Math.min(filters.page, pages);
    return {
      shops: results.slice((page - 1) * 12, page * 12), total: results.length, productShops, page, pages,
      cities: directoryOptions(shops.map(s => s.city)),
      localities: directoryOptions(shops.filter(s => !filters.city || s.city?.trim().toLowerCase() === filters.city.toLowerCase()).map(s => s.locality)),
      categories: directoryOptions(shops.map(s => s.category)),
    };
  });

export const suggestDirectory = createServerFn({ method: 'GET' })
  .inputValidator((input: Record<string, unknown>) => normalizeDiscovery(input))
  .handler(async ({ data: filters }) => {
    const shops = filterDirectory(await loadDirectory(), { ...filters, q: '' });
    return buildSuggestions(shops, filters.q);
  });
