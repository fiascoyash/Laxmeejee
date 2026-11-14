import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { directoryOptions, filterDirectory, normalizeDiscovery, type DirectoryShop, type DirectoryProduct } from './discovery';

export const searchDirectory = createServerFn({ method: 'GET' })
  .inputValidator((input: Record<string, unknown>) => normalizeDiscovery(input))
  .handler(async ({ data: filters }) => {
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    const url = process.env['SUPABASE_URL'];
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
        .select('id, slug, public_name, category, city, locality, address, hours, tagline')
        .eq('is_published', true).order('public_name').order('id').range(offset, offset + 499);
      if (error) throw new Error('Could not load shops. Please try again.');
      shops.push(...(data ?? []).map(shop => ({ ...shop, products: [] })));
      if (!data || data.length < 500) break;
    }
    const byId = new Map(shops.map(shop => [shop.id, shop]));
    // Anonymous RLS permits only products belonging to published shops.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from('shop_products')
        .select('business_id, name, category, price, unit, in_stock')
        .order('business_id').order('product_id').range(offset, offset + 499);
      if (error) throw new Error('Could not load products. Please try again.');
      for (const { business_id, ...product } of data ?? []) byId.get(business_id)?.products.push(product as DirectoryProduct);
      if (!data || data.length < 500) break;
    }
    const results = filterDirectory(shops, filters);
    const pages = Math.max(1, Math.ceil(results.length / 12));
    const page = Math.min(filters.page, pages);
    return {
      shops: results.slice((page - 1) * 12, page * 12), total: results.length, page, pages,
      cities: directoryOptions(shops.map(s => s.city)),
      localities: directoryOptions(shops.filter(s => !filters.city || s.city?.trim().toLowerCase() === filters.city.toLowerCase()).map(s => s.locality)),
      categories: directoryOptions(shops.map(s => s.category)),
    };
  });