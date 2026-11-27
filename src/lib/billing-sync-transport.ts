import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { BillingRow, BillingTransport } from './billing-sync';

// Owner-created table is not in the generated schema yet. Reuse the existing client/session;
// never create an alternate client or edit generated connection values.
const client: SupabaseClient = supabase;
const columns = 'business_id,collection,record_id,data,deleted,updated_at';
export const billingSyncTransport: BillingTransport = {
  async read(businessId) {
    const rows: BillingRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from('business_records').select(columns)
        .eq('business_id', businessId).order('collection').order('record_id')
        .range(offset, offset + 499).abortSignal(AbortSignal.timeout(20000));
      if (error) throw new Error('Could not load billing sync. Check your connection and business_records access, then retry.');
      const page = (data ?? []) as BillingRow[];
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  },
  async write(rows) {
    const { data, error } = await client.from('business_records')
      .upsert(rows.map(({ updated_at: _timestamp, ...row }) => row), { onConflict: 'business_id,collection,record_id' })
      .select(columns).abortSignal(AbortSignal.timeout(20000));
    if (error) throw new Error('Cloud save could not be confirmed. Your changes remain on this device and will retry automatically.');
    return (data ?? []) as BillingRow[];
  },
  subscribe(businessId, changed) {
    const channel = client.channel(`billing-${businessId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_records', filter: `business_id=eq.${businessId}` }, changed)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};