import { billingCollections, billingKeys, observeBillingWrites } from './billing-cache';

export type BillingRow = {
  business_id: string; collection: string; record_id: string;
  data: unknown; deleted: boolean; updated_at?: string;
};
export interface BillingTransport {
  read(businessId: string): Promise<BillingRow[]>;
  write(rows: BillingRow[]): Promise<BillingRow[]>;
  subscribe(businessId: string, changed: () => void): () => void;
}
type Snapshot = { values: Record<string, string>; pending: Record<string, BillingRow>; hydrated: boolean };
export type SyncState = 'loading' | 'import' | 'syncing' | 'saved' | 'offline' | 'error';
const LEGACY = 'hisaaboo_billing_legacy_backup_v1';
const CLAIM = 'hisaaboo_billing_legacy_owner_v1';
export const shopCacheKey = (id: string) => `hisaaboo_billing_cache_v1:${id}`;
const rowKey = (r: Pick<BillingRow, 'collection' | 'record_id'>) => JSON.stringify([r.collection, r.record_id]);

export function recordsForValue(collection: string, list: boolean, raw: string | null): Map<string, unknown> {
  if (raw === null) return new Map();
  const value: unknown = JSON.parse(raw);
  if (!list) return new Map([['settings', value]]);
  if (!Array.isArray(value)) throw new Error('Invalid billing collection. Your original data has not been removed.');
  const result = new Map<string, unknown>();
  for (const record of value) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) {
      throw new Error(`A ${collection} record has no ID. Your original data has not been removed.`);
    }
    if (result.has(record.id)) throw new Error(`Duplicate ${collection} ID. Your original data has not been removed.`);
    result.set(record.id, record);
  }
  return result;
}

/** One controller per mounted business. No server code or alternate connection. */
export class BillingSync {
  private snapshot: Snapshot;
  private stopped = false;
  private active = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private unsubscribe: (() => void) | undefined;
  private running: Promise<void> | undefined;
  private rerun = false;
  private remote: BillingRow[] = [];
  state: SyncState = 'loading';
  error = '';
  ready = false;
  importCount = 0;
  constructor(readonly businessId: string, private transport: BillingTransport, private changed: () => void) {
    const raw = localStorage.getItem(shopCacheKey(businessId));
    this.snapshot = raw ? JSON.parse(raw) as Snapshot : { values: {}, pending: {}, hydrated: false };
  }
  private notify(state: SyncState, error = '') {
    if (this.stopped) return;
    this.state = state; this.error = error; this.changed();
  }
  private persist() { localStorage.setItem(shopCacheKey(this.businessId), JSON.stringify(this.snapshot)); }
  private loadSnapshot() {
    const raw = localStorage.getItem(shopCacheKey(this.businessId));
    if (raw) this.snapshot = JSON.parse(raw) as Snapshot;
  }
  private legacy(): Record<string, string> {
    const raw = localStorage.getItem(LEGACY);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  }
  private captureLegacy() {
    if (localStorage.getItem(LEGACY) || localStorage.getItem(CLAIM)) return;
    const values: Record<string, string> = {};
    for (const key of billingKeys) {
      const value = localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
    localStorage.setItem(LEGACY, JSON.stringify(values));
  }
  async start() {
    this.captureLegacy();
    try {
      this.remote = await this.transport.read(this.businessId);
      if (this.stopped) return;
      const legacy = this.legacy();
      if (!this.snapshot.hydrated && !localStorage.getItem(CLAIM) && Object.keys(legacy).length) {
        this.importCount = billingCollections.reduce((count, c) => count + recordsForValue(c.collection, c.list, legacy[c.key] ?? null).size, 0);
        this.notify('import'); return;
      }
      this.activate();
      await this.tick();
    } catch (error) {
      if (this.stopped) return;
      if (this.snapshot.hydrated) {
        this.activate(false);
        this.notify('offline', 'Your changes are saved on this device and will retry automatically.');
      } else this.notify('error', error instanceof Error ? error.message : 'Could not load your billing data.');
    }
  }
  async chooseImport(importData: boolean) {
    const legacy = this.legacy();
    if (importData) {
      const known = new Set(this.remote.map(rowKey));
      for (const c of billingCollections) {
        for (const [id, data] of recordsForValue(c.collection, c.list, legacy[c.key] ?? null)) {
          const row: BillingRow = { business_id: this.businessId, collection: c.collection, record_id: id, data, deleted: false };
          // Existing server records (including tombstones) win during the one-time import.
          if (!known.has(rowKey(row))) this.snapshot.pending[rowKey(row)] = row;
        }
      }
      for (const key of billingKeys) if (legacy[key] !== undefined) this.snapshot.values[key] = legacy[key];
    }
    this.persist();
    localStorage.setItem(CLAIM, this.businessId);
    this.activate();
    await this.tick();
  }
  private activate(applyRemote = true) {
    if (this.stopped || this.active) return;
    if (applyRemote) this.merge(this.remote);
    this.persist();
    // Never expose the previous account's working keys while mounting the app.
    for (const key of billingKeys) {
      const value = this.snapshot.values[key];
      if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, value);
    }
    this.active = true;
    observeBillingWrites((key, value) => this.recordWrite(key, value), key => this.snapshot.values[key] ?? null);
    this.ready = true;
    this.unsubscribe = this.transport.subscribe(this.businessId, () => { void this.tick(); });
    this.timer = setInterval(() => { void this.tick(); }, 15000);
    window.addEventListener('online', this.retry);
    window.addEventListener('focus', this.retry);
    window.addEventListener('storage', this.otherTab);
    this.notify(Object.keys(this.snapshot.pending).length ? 'syncing' : 'saved');
  }
  private recordWrite(key: string, value: string | null) {
    if (!billingKeys.includes(key) || this.stopped) return;
    this.loadSnapshot();
    const next: Snapshot = { ...this.snapshot, values: { ...this.snapshot.values }, pending: { ...this.snapshot.pending } };
    const c = billingCollections.find(c => c.key === key);
    if (c) {
      const before = recordsForValue(c.collection, c.list, next.values[key] ?? null);
      const after = recordsForValue(c.collection, c.list, value);
      for (const id of new Set([...before.keys(), ...after.keys()])) {
        if (before.has(id) === after.has(id) && JSON.stringify(before.get(id)) === JSON.stringify(after.get(id))) continue;
        const row: BillingRow = { business_id: this.businessId, collection: c.collection, record_id: id, data: after.get(id) ?? {}, deleted: !after.has(id) };
        next.pending[rowKey(row)] = row;
      }
    }
    if (value === null) delete next.values[key]; else next.values[key] = value;
    localStorage.setItem(shopCacheKey(this.businessId), JSON.stringify(next));
    this.snapshot = next;
    if (Object.keys(next.pending).length) {
      this.notify('syncing');
      // Defer until the legacy working key and any synchronous stock rollback finish.
      queueMicrotask(() => { void this.tick(); });
    }
  }
  private merge(rows: BillingRow[]) {
    const merged = new Map(rows.filter(r => r.business_id === this.businessId).map(r => [rowKey(r), r]));
    for (const [key, row] of Object.entries(this.snapshot.pending)) merged.set(key, row);
    for (const c of billingCollections) {
      const records = [...merged.values()].filter(r => r.collection === c.collection);
      const live = records.filter(r => !r.deleted);
      if (!records.length) {
        if (c.list) this.snapshot.values[c.key] = '[]';
        else delete this.snapshot.values[c.key];
      } else if (c.list) this.snapshot.values[c.key] = JSON.stringify(live.map(r => r.data));
      else {
        const singleton = live.find(r => r.record_id === 'settings');
        if (singleton) this.snapshot.values[c.key] = JSON.stringify(singleton.data);
        else delete this.snapshot.values[c.key];
      }
    }
    this.snapshot.hydrated = true;
  }
  private retry = () => { void this.tick(); };
  private otherTab = (event: StorageEvent) => {
    if (event.key !== shopCacheKey(this.businessId)) return;
    this.loadSnapshot();
    window.dispatchEvent(new Event('hisaaboo:billing-refreshed'));
    void this.tick();
  };
  tick(): Promise<void> {
    if (this.stopped || !this.active) return Promise.resolve();
    if (this.running) { this.rerun = true; return this.running; }
    this.running = this.synchronize().finally(() => {
      this.running = undefined;
      if (this.rerun && !this.stopped) { this.rerun = false; void this.tick(); }
    });
    return this.running;
  }
  private async synchronize() {
    try {
      this.loadSnapshot();
      const pending = Object.entries(this.snapshot.pending);
      if (pending.length) this.notify('syncing');
      for (let offset = 0; offset < pending.length; offset += 50) {
        const batch = pending.slice(offset, offset + 50);
        const saved = await this.transport.write(batch.map(([, row]) => row));
        if (this.stopped) return;
        const acknowledged = new Set(saved.filter(r => r.business_id === this.businessId).map(rowKey));
        if (batch.some(([key]) => !acknowledged.has(key))) throw new Error('Your save was not confirmed. It remains on this device for retry.');
        this.loadSnapshot();
        for (const [key, row] of batch) if (JSON.stringify(this.snapshot.pending[key]) === JSON.stringify(row)) delete this.snapshot.pending[key];
        this.persist();
      }
      const rows = await this.transport.read(this.businessId);
      if (this.stopped) return;
      this.loadSnapshot();
      this.merge(rows);
      this.persist();
      let updated = false;
      for (const c of billingCollections) {
        const value = this.snapshot.values[c.key];
        if (localStorage.getItem(c.key) !== (value ?? null)) {
          if (value === undefined) localStorage.removeItem(c.key); else localStorage.setItem(c.key, value);
          updated = true;
        }
      }
      if (updated) window.dispatchEvent(new Event('hisaaboo:billing-refreshed'));
      this.notify(Object.keys(this.snapshot.pending).length ? 'syncing' : 'saved');
    } catch (error) {
      this.notify('offline', error instanceof Error ? error.message : 'Sync will retry automatically.');
    }
  }
  stop() {
    this.stopped = true;
    if (this.active) observeBillingWrites();
    if (this.timer) clearInterval(this.timer);
    this.unsubscribe?.();
    window.removeEventListener('online', this.retry);
    window.removeEventListener('focus', this.retry);
    window.removeEventListener('storage', this.otherTab);
    // Snapshot survives sign-out; active keys do not leak to another merchant.
    if (this.active) for (const key of billingKeys) localStorage.removeItem(key);
  }
}