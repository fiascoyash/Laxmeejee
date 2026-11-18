import { describe, expect, it } from 'vitest';
import { isSyncedKey, planHydrate } from '@/lib/cloud-sync';

describe('cloud sync rules', () => {
  it('syncs invoices, quotations and shop data keys', () => {
    expect(isSyncedKey('solar_invoices')).toBe(true);
    expect(isSyncedKey('solar_quotations')).toBe(true);
    expect(isSyncedKey('laxmeejee_suppliers')).toBe(true);
    expect(isSyncedKey('hisaaboo_credit_debit_notes')).toBe(true);
    expect(isSyncedKey('hisaaboo:auth-mode')).toBe(false);
  });
  it('another device loads the saved cloud copy', () => {
    expect(planHydrate({ solar_invoices: '[]' }, null, 'u1')).toBe('use-remote');
  });
  it('a different merchant on the same device never sees the previous data', () => {
    expect(planHydrate(null, 'u2', 'u1')).toBe('start-empty');
  });
  it('first sign-in uploads existing device data', () => {
    expect(planHydrate(null, null, 'u1')).toBe('upload-local');
  });
});
