import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => ({
  inputValidator: () => ({ handler: (handler: (input: unknown) => unknown) => handler }),
}) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (table: string) => {
  let publishedOnly = false;
  const chain = {
    select: (columns: string) => { query.select(table, columns); return chain; },
    eq: (key: string, value: unknown) => { query.eq(table, key, value); if (key === 'is_published' && value === true) publishedOnly = true; return chain; },
    order: () => chain,
    range: async () => ({ data: table === 'businesses' ? [
      { id: 'public', slug: 'public-shop', public_name: 'Published Shop', category: null, city: 'Bijnor', locality: null, address: null, hours: null, tagline: null },
      ...(!publishedOnly ? [{ id: 'private', slug: 'private-shop', public_name: 'Unpublished Shop', category: null, city: 'Delhi', locality: null, address: null, hours: null, tagline: null }] : []),
    ] : [], error: null }),
  };
  return chain;
} }) }));

import { searchDirectory } from '@/lib/discovery.functions';
import { normalizeDiscovery } from '@/lib/discovery';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_URL', 'http://localhost:54321');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-public-key');
});
afterEach(() => vi.unstubAllEnvs());

it('excludes unpublished shops and reads no customer, invoice or purchase details', async () => {
  const result = await searchDirectory({ data: normalizeDiscovery({}) });
  expect(result.shops.map(shop => shop.slug)).toEqual(['public-shop']);
  expect(result.cities).toEqual(['Bijnor']);
  expect(query.eq).toHaveBeenCalledWith('businesses', 'is_published', true);
  expect(query.select.mock.calls.map(call => call[0])).toEqual(['businesses', 'shop_products']);
  expect(query.select.mock.calls[0]?.[1]).toBe('id, slug, public_name, category, city, locality, address, hours, tagline');
});