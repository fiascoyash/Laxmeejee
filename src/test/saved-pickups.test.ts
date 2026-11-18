import { beforeEach, describe, expect, it } from 'vitest';
import { PICKUP_STORAGE_KEY, readSavedPickups, removeSavedPickup, savePickup } from '@/lib/saved-pickups';

const order = { code: 'ABCDEF', phone: '9876543210', nickname: 'Chai Lover', slug: 'test-shop' };
beforeEach(() => localStorage.clear());
describe('Saved active pickups', () => {
  it('remembers the code, nickname and phone after reading storage again', () => {
    expect(savePickup(order)).toBe(true);
    expect(readSavedPickups()).toEqual([order]);
  });
  it('retains multiple active orders without duplicating the same code and phone', () => {
    savePickup(order); savePickup({ ...order, code: 'FEDCBA' }); savePickup(order);
    expect(readSavedPickups().map(r => r.code)).toEqual(['ABCDEF', 'FEDCBA']);
  });
  it('removes a completed order without removing another customer’s matching code', () => {
    savePickup(order); savePickup({ ...order, phone: '9987654321' });
    removeSavedPickup(order.code, order.phone);
    expect(readSavedPickups()).toEqual([{ ...order, phone: '9987654321' }]);
  });
  it('ignores corrupt storage without altering billing data', () => {
    localStorage.setItem('solar_product_catalog', 'keep');
    localStorage.setItem(PICKUP_STORAGE_KEY, '{');
    expect(readSavedPickups()).toEqual([]);
    savePickup(order);
    expect(localStorage.getItem('solar_product_catalog')).toBe('keep');
  });
});