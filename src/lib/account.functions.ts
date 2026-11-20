import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ACCOUNT_TABLES, confirmAccountDeletion, readAllRows } from './account-data';
import type { Json } from '@/integrations/supabase/types';

export const exportAccountData = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tables: Record<string, unknown[]> = {};
    await Promise.all(ACCOUNT_TABLES.map(async table => {
      tables[table] = await readAllRows((from, to) => context.supabase.from(table).select('*').eq('owner_id', context.userId).order('id').range(from, to));
    }));
    const { db } = await import('./db');
    // Reuse the authenticated RLS client, not the browser client exported by db.
    const client = context.supabase as unknown as typeof db;
    const memberships = await readAllRows((from, to) => client.from('business_members').select('*').eq('user_id', context.userId).order('business_id').range(from, to));
    tables['business_members'] = memberships;
    const stores = await Promise.all(memberships.map(async membership => {
      const id = membership.business_id;
      const [shops, products, orders] = await Promise.all([
        readAllRows((from, to) => client.from('businesses').select('*').eq('id', id).order('id').range(from, to)),
        readAllRows((from, to) => client.from('shop_products').select('*').eq('business_id', id).order('product_id').range(from, to)),
        readAllRows((from, to) => client.from('pickup_orders').select('*').eq('business_id', id).order('id').range(from, to)),
      ]);
      return { shops, products, orders };
    }));
    tables['businesses'] = stores.flatMap(s => s.shops);
    tables['shop_products'] = stores.flatMap(s => s.products);
    tables['pickup_orders'] = stores.flatMap(s => s.orders);
    // Database results are JSON; normalize them before crossing the RPC boundary.
    const serializableTables = JSON.parse(JSON.stringify(tables)) as Record<string, Json[]>;
    return { format: 'hisaaboo-account-backup', version: 1, exportedAt: new Date().toISOString(), tables: serializableTables };
  });

export const deleteAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => {
    if (typeof input?.confirmation !== 'string') throw new Error('Email confirmation is required.');
    return { confirmation: input.confirmation };
  })
  .handler(async ({ data, context }) => {
    // getClaims alone does not detect deleted users or revoked sessions.
    const { getRequest } = await import('@tanstack/react-start/server');
    const token = getRequest().headers.get('authorization')?.replace(/^Bearer /, '');
    const { data: auth, error } = await context.supabase.auth.getUser(token);
    if (error || !auth.user || auth.user.id !== context.userId) throw new Error('Please sign in again before deleting your account.');
    confirmAccountDeletion(data.confirmation, auth.user.email);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { removeMerchantAccount } = await import('./account-cleanup.server');
    return removeMerchantAccount(supabaseAdmin as unknown as Parameters<typeof removeMerchantAccount>[0], context.userId);
  });