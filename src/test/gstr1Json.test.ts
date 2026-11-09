// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { buildGstr1Json, periodFromFy } from '../legacy/utils/gstr1Json';
import { selectInvoicesForPdf, safeFileName } from '../legacy/components/gst/Gstr1Exports';

const CO = '27AAPFU0939F1ZV';
const item = (o = {}) => ({ id: 'p', name: 'Rice', quantity: 2, unitPrice: 100, unit: 'kg', gstPercent: 18, hsnSacCode: '1006', discount: 0, ...o });
const inv = (o = {}) => ({ id: Math.random().toString(), invoiceNumber: 'INV-1', date: '2026-10-05', status: 'Paid', gstMode: 'exclusive', grandTotal: 236, customer: { name: 'A', gstNumber: '' }, products: [item()], ...o });

describe('GSTR-1 JSON', () => {
  it('maps October of FY 2026-27 to period 102026', () => {
    expect(periodFromFy('2026-27', 9)).toEqual({ year: 2026, month: 10 });
    expect(periodFromFy('2026-27', 0)).toEqual({ year: 2027, month: 1 });
    expect(buildGstr1Json([], CO, 2026, 10).fp).toBe('102026');
  });
  it('puts GSTIN customers in b2b and others in b2cs', () => {
    const r = buildGstr1Json([inv({ invoiceNumber: 'A1', customer: { name: 'B', gstNumber: '29AABCU9603R1ZM' } }), inv({ invoiceNumber: 'A2' })], CO, 2026, 10);
    expect(r.json.b2b[0].ctin).toBe('29AABCU9603R1ZM');
    expect(r.json.b2b[0].inv[0].itms[0].itm_det.iamt).toBe(36);
    expect(r.json.b2cs[0].camt).toBe(18);
  });
  it('excludes drafts, other months and invalid invoices, flagging errors', () => {
    const r = buildGstr1Json([inv({ status: 'Draft' }), inv({ date: '2026-11-01' }), inv({ invoiceNumber: 'X', customer: { name: 'C', gstNumber: 'BAD' } })], CO, 2026, 10);
    expect(r.included.length).toBe(0);
    expect(r.excluded.length).toBe(1);
    expect(r.blocking.some(b => b.message.includes('invalid'))).toBe(true);
  });
  it('blocks export when company GSTIN is missing', () => {
    expect(buildGstr1Json([inv()], '', 2026, 10).companyBlocked).toBe(true);
  });
});

describe('Invoice PDF selection', () => {
  it('includes both end dates and excludes drafts', () => {
    const list = [inv({ id: '1', date: '2026-10-01' }), inv({ id: '2', date: '2026-10-31' }), inv({ id: '3', date: '2026-11-01' }), inv({ id: '4', status: 'Draft' })];
    const s = selectInvoicesForPdf(list, '2026-10-01', '2026-10-31');
    expect(s.included.map(i => i.id)).toEqual(['1', '2']);
    expect(s.excluded.map(i => i.id)).toEqual(['4']);
  });
  it('sanitizes file names', () => {
    expect(safeFileName('INV/2026 #1')).toBe('INV-2026-1');
  });
});
