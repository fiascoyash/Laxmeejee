import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as ShopDatabase } from './db-types';
import type { Database as AccountDatabase } from '@/integrations/supabase/types';
import { ACCOUNT_TABLES, readAllRows } from './account-data';

type Database = ShopDatabase & { public: { Tables: AccountDatabase['public']['Tables'] } };

/** The user ID must come from a freshly validated session, never from form data. */
export async function removeMerchantAccount(admin: SupabaseClient<Database>, userId: string) {
  const memberships = await readAllRows((from, to) => admin.from('business_members').select('business_id, role').eq('user_id', userId).order('business_id').range(from, to));
  const shopIds = memberships.filter(m => m.role === 'owner').map(m => m.business_id);
  // Check every shop before making any destructive change.
  for (const id of shopIds) {
    const { count, error } = await admin.from('business_members').select('user_id', { count: 'exact', head: true }).eq('business_id', id).eq('role', 'owner').neq('user_id', userId);
    if (error) throw new Error('Could not check shop ownership. Nothing has been deleted.');
    if (count) throw new Error('This shop has another owner. Resolve shared shop ownership before deleting your account.');
  }
  // Storage must be emptied before Auth can delete the user. All photo paths are user-id scoped.
  for (;;) {
    const { data, error } = await admin.storage.from('product-photos').list(userId, { limit: 100, offset: 0 });
    if (error) throw new Error('Could not remove product photos. Your account is still open; please retry.');
    if (!data?.length) break;
    const removed = await admin.storage.from('product-photos').remove(data.map(file => `${userId}/${file.name}`));
    if (removed.error) throw new Error('Could not remove product photos. Your account is still open; please retry.');
  }
  async function check(result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error('Account cleanup stopped. Some records may already be removed. Your account is still open; please retry deletion.');
  }
  for (const id of shopIds) {
    // Explicit child cleanup also supports shops without cascading foreign keys.
    await check(admin.from('pickup_orders').delete().eq('business_id', id));
    await check(admin.from('shop_products').delete().eq('business_id', id));
    await check(admin.from('business_members').delete().eq('business_id', id));
    await check(admin.from('businesses').delete().eq('id', id));
  }
  await check(admin.from('business_members').delete().eq('user_id', userId));
  for (const table of ACCOUNT_TABLES) await check(admin.from(table).delete().eq('owner_id', userId));
  await check(admin.from('user_roles').delete().eq('user_id', userId));
  await check(admin.from('profiles').delete().eq('id', userId));
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error('Your business data was removed, but account closure failed. Please retry to finish.');
  return { deleted: true as const };
}