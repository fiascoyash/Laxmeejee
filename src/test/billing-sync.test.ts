import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { BillingSync, recordsForValue, shopCacheKey, type BillingRow, type BillingTransport } from '@/lib/billing-sync';
import { billingStorage, observeBillingWrites } from '@/lib/billing-cache';

const controllers: BillingSync[] = [];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function service(initial: BillingRow[] = []) {
  const rows = new Map(initial.map(r => [JSON.stringify([r.business_id, r.collection, r.record_id]), clone(r)]));
  let fail = false;
  let changed = () => {};
  const transport: BillingTransport = {
    read: vi.fn(async id => {
      if (fail) throw new Error('Offline');
      return clone([...rows.values()].filter(r => r.business_id === id));
    }),
    write: vi.fn(async updates => {
      if (fail) throw new Error('Offline');
      for (const r of updates) rows.set(JSON.stringify([r.business_id, r.collection, r.record_id]), clone(r));
      return clone(updates);
    }),
    subscribe: (_id, callback) => { changed = callback; return () => { changed = () => {}; }; },
  };
  return { transport, rows, setOffline: (value: boolean) => { fail = value; }, refresh: () => changed() };
}
function controller(id: string, transport: BillingTransport) {
  const sync = new BillingSync(id, transport, () => {});
  controllers.push(sync); return sync;
}
const row = (shop: string, collection: string, id: string, data: unknown, deleted = false): BillingRow => ({ business_id: shop, collection, record_id: id, data, deleted });
const settled = async (sync: BillingSync) => { await sync.tick(); await waitFor(() => expect(sync.state).toBe('saved')); };

beforeEach(() => { localStorage.clear(); observeBillingWrites(); });
afterEach(() => { controllers.splice(0).forEach(c => c.stop()); observeBillingWrites(); });

describe('billing sync with the owner-created table', () => {
  it('requires confirmation before uploading existing invoices, customers and settings', async () => {
    billingStorage.setItem('solar_invoices', JSON.stringify([{ id: 'inv-1', grandTotal: 1180 }]));
    billingStorage.setItem('solar_customers', JSON.stringify([{ id: 'cust-1', name: 'Asha' }]));
    billingStorage.setItem('solar_company_profile', JSON.stringify({ companyName: 'Asha Store' }));
    const cloud = service(); const sync = controller('shop-a', cloud.transport);
    await sync.start();
    expect(sync.state).toBe('import'); expect(sync.ready).toBe(false);
    expect(sync.importCount).toBe(3); expect(cloud.transport.write).not.toHaveBeenCalled();
    await sync.chooseImport(true); await settled(sync);
    expect([...cloud.rows.values()]).toEqual(expect.arrayContaining([
      row('shop-a', 'invoices', 'inv-1', { id: 'inv-1', grandTotal: 1180 }),
      row('shop-a', 'customers', 'cust-1', { id: 'cust-1', name: 'Asha' }),
      row('shop-a', 'company_profile', 'settings', { companyName: 'Asha Store' }),
    ]));
    expect(localStorage.getItem('hisaaboo_billing_legacy_backup_v1')).toContain('1180');
  });
  it('never overwrites online records or resurrects deleted IDs during initial import', async () => {
    billingStorage.setItem('solar_invoices', JSON.stringify([{ id: 'inv-1', grandTotal: 100 }, { id: 'inv-deleted', grandTotal: 200 }]));
    const cloud = service([row('shop-a', 'invoices', 'inv-1', { id: 'inv-1', grandTotal: 1180 }), row('shop-a', 'invoices', 'inv-deleted', {}, true)]);
    const sync = controller('shop-a', cloud.transport); await sync.start(); await sync.chooseImport(true); await settled(sync);
    expect(JSON.parse(billingStorage.getItem('solar_invoices') ?? '[]')).toEqual([{ id: 'inv-1', grandTotal: 1180 }]);
    expect(cloud.transport.write).not.toHaveBeenCalled();
  });
  it('lets the merchant decline the browser import without losing its backup', async () => {
    billingStorage.setItem('solar_customers', JSON.stringify([{ id: 'old', name: 'Other shop' }]));
    const cloud = service(); const sync = controller('shop-a', cloud.transport);
    await sync.start(); await sync.chooseImport(false); await settled(sync);
    expect(billingStorage.getItem('solar_customers')).toBe('[]');
    expect(cloud.transport.write).not.toHaveBeenCalled();
    expect(localStorage.getItem('hisaaboo_billing_legacy_backup_v1')).toContain('Other shop');
  });
  it('saves changes per record without overwriting unchanged records on another device', async () => {
    const cloud = service([row('shop-a', 'customers', 'c1', { id: 'c1', name: 'Asha' }), row('shop-a', 'customers', 'c2', { id: 'c2', name: 'Neha' })]);
    const sync = controller('shop-a', cloud.transport); await sync.start();
    await cloud.transport.write([row('shop-a', 'customers', 'c2', { id: 'c2', name: 'Neha updated elsewhere' })]);
    billingStorage.setItem('solar_customers', JSON.stringify([{ id: 'c1', name: 'Asha updated here' }, { id: 'c2', name: 'Neha' }]));
    await settled(sync);
    expect(JSON.parse(billingStorage.getItem('solar_customers') ?? '[]')).toEqual(expect.arrayContaining([
      { id: 'c1', name: 'Asha updated here' }, { id: 'c2', name: 'Neha updated elsewhere' },
    ]));
  });
  it('keeps an offline queue across reload and uploads it when connection returns', async () => {
    const cloud = service(); let sync = controller('shop-a', cloud.transport); await sync.start();
    cloud.setOffline(true);
    billingStorage.setItem('solar_invoices', JSON.stringify([{ id: 'inv-1', grandTotal: 1180, status: 'Draft' }]));
    await sync.tick(); expect(sync.state).toBe('offline'); sync.stop();
    sync = controller('shop-a', cloud.transport); await sync.start();
    expect(sync.ready).toBe(true);
    expect(JSON.parse(billingStorage.getItem('solar_invoices') ?? '[]')[0]).toEqual({ id: 'inv-1', grandTotal: 1180, status: 'Draft' });
    cloud.setOffline(false); await settled(sync);
    expect([...cloud.rows.values()]).toContainEqual(row('shop-a', 'invoices', 'inv-1', { id: 'inv-1', grandTotal: 1180, status: 'Draft' }));
  });
  it('propagates soft deletions to a fresh device and does not reimport stale browser backups', async () => {
    const cloud = service([row('shop-a', 'customers', 'c1', { id: 'c1', name: 'Asha' })]);
    let sync = controller('shop-a', cloud.transport); await sync.start();
    billingStorage.setItem('solar_customers', '[]'); await settled(sync); sync.stop();
    localStorage.removeItem(shopCacheKey('shop-a'));
    sync = controller('shop-a', cloud.transport); await sync.start(); await settled(sync);
    expect(billingStorage.getItem('solar_customers')).toBe('[]');
    expect([...cloud.rows.values()]).toContainEqual(row('shop-a', 'customers', 'c1', {}, true));
  });
  it('isolates cached invoices, settings, notes and stock histories between merchants', async () => {
    const cloud = service(); let sync = controller('shop-a', cloud.transport); await sync.start();
    billingStorage.setItem('solar_invoices', JSON.stringify([{ id: 'a', grandTotal: 1180 }]));
    billingStorage.setItem('hisaaboo_credit_debit_notes', JSON.stringify([{ id: 'note-a' }]));
    billingStorage.setItem('laxmeejee_product_purchases', JSON.stringify([{ id: 'purchase-a' }]));
    await settled(sync); sync.stop();
    sync = controller('shop-b', cloud.transport); await sync.start();
    expect(billingStorage.getItem('solar_invoices')).toBe('[]');
    expect(billingStorage.getItem('solar_company_profile')).toBeNull();
    expect(billingStorage.getItem('hisaaboo_credit_debit_notes')).toBeNull();
    expect(billingStorage.getItem('laxmeejee_product_purchases')).toBeNull();
    expect([...cloud.rows.values()].some(r => r.collection.includes('notes') || r.collection.includes('purchases'))).toBe(false);
    sync.stop(); sync = controller('shop-a', cloud.transport); await sync.start();
    expect(billingStorage.getItem('hisaaboo_credit_debit_notes')).toContain('note-a');
    expect(billingStorage.getItem('laxmeejee_product_purchases')).toContain('purchase-a');
  });
  it('refreshes server edits without resetting current unsaved form state', async () => {
    const refreshed = vi.fn(); window.addEventListener('hisaaboo:billing-refreshed', refreshed);
    const cloud = service(); const sync = controller('shop-a', cloud.transport); await sync.start();
    await cloud.transport.write([row('shop-a', 'products', 'p1', { id: 'p1', stockQuantity: 2.5 })]);
    cloud.refresh(); await settled(sync);
    expect(JSON.parse(billingStorage.getItem('solar_product_catalog') ?? '[]')).toEqual([{ id: 'p1', stockQuantity: 2.5 }]);
    expect(refreshed).toHaveBeenCalled(); window.removeEventListener('hisaaboo:billing-refreshed', refreshed);
  });
  it('does not mark denied or unconfirmed writes as synced', async () => {
    const cloud = service(); cloud.transport.write = vi.fn(async () => []);
    const sync = controller('shop-a', cloud.transport); await sync.start();
    billingStorage.setItem('solar_customers', JSON.stringify([{ id: 'c1', name: 'Asha' }]));
    await sync.tick(); expect(sync.state).toBe('offline');
    expect(localStorage.getItem(shopCacheKey('shop-a'))).toContain('Asha');
    expect(JSON.parse(billingStorage.getItem('solar_customers') ?? '[]')).toEqual([{ id: 'c1', name: 'Asha' }]);
  });
  it('rejects malformed IDs rather than silently discarding existing records', () => {
    expect(() => recordsForValue('invoices', true, '[{"grandTotal":1180}]')).toThrow('no ID');
    expect(() => recordsForValue('customers', true, '[{"id":"c1"},{"id":"c1"}]')).toThrow('Duplicate');
  });
  it('ignores stale responses after the merchant signs out', async () => {
    const cloud = service(); const sync = controller('shop-a', cloud.transport); await sync.start();
    let finish: ((rows: BillingRow[]) => void) | undefined;
    cloud.transport.read = () => new Promise(resolve => { finish = resolve; });
    const pending = sync.tick(); sync.stop();
    finish?.([row('shop-a', 'invoices', 'private', { id: 'private', grandTotal: 1180 })]);
    await pending;
    expect(localStorage.getItem('solar_invoices')).toBeNull();
  });
});