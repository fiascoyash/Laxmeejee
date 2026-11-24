import { describe, it, expect } from 'vitest';
import { recalcLine } from './lineAmount';
import { calculateProductAmount } from './storage';

const base: any = { id: 'a', name: 'x', hsnSacCode: '', gstPercent: 5, quantity: 1, unit: 'piece', unitPrice: 13333.33 };

describe('recalcLine', () => {
  it('inclusive: rate 13333.33 at 5% qty 1 gives amount 14000', () => {
    expect(calculateProductAmount(recalcLine({ ...base, priceSource: 'rate' }, 'inclusive'))).toBe(14000);
  });
  it('exclusive: amount is rate × qty', () => {
    expect(calculateProductAmount(recalcLine({ ...base, quantity: 3, unitPrice: 100, priceSource: 'rate' }, 'exclusive'))).toBe(300);
  });
  it('cleared rate gives zero amount, not NaN', () => {
    expect(calculateProductAmount(recalcLine({ ...base, unitPrice: 0, priceSource: 'rate' }, 'inclusive'))).toBe(0);
  });
  it('qty change on a rate-sourced row recalculates amount', () => {
    expect(calculateProductAmount(recalcLine({ ...base, unitPrice: 100, quantity: 2, priceSource: 'rate' }, 'inclusive'))).toBe(210);
  });
  it('amount-sourced row keeps amount and re-derives rate on mode change', () => {
    const out = recalcLine({ ...base, manualAmount: 14000, isManualAmount: true, priceSource: 'amount' }, 'exclusive');
    expect(calculateProductAmount(out)).toBe(14000);
    expect(out.unitPrice).toBe(14000);
  });
});
