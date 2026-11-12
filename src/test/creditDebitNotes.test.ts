// @ts-nocheck -- exercises loosely typed legacy utilities
import { beforeEach, describe, expect, it } from 'vitest';
import { buildNoteFromInvoice, validateNote, computeNote, saveNote, loadNotes, nextNoteNumber, outwardNet, NOTES_KEY } from '@/legacy/utils/creditDebitNotes';
import { buildGstr1Json } from '@/legacy/utils/gstr1Json';

const CO = '27AAAAA0000A1Z5';
const inv: any = { id: 'inv1', invoiceNumber: 'INV-001', date: '2026-10-05', status: 'Unpaid', gstMode: 'exclusive', grandTotal: 1180,
  customer: { name: 'Ram Traders', gstNumber: '27BBBBB1111B1Z5', billingAddress: 'Pune' },
  products: [{ id: 'p1', name: 'Panel', hsnSacCode: '8541', gstPercent: 18, quantity: 10, unit: 'piece', unitPrice: 100 }] };

beforeEach(() => localStorage.clear());

describe('credit / debit note rules', () => {
  it('pre-fills from the invoice with locked references and CN-YYYY-### numbering', () => {
    const n = buildNoteFromInvoice(inv, 'Credit Note', CO, [], [], '2026-10-20');
    expect(n.noteNumber).toBe('CN-2026-001');
    expect(n.originalInvoiceNumber).toBe('INV-001');
    expect(n.customerGstin).toBe('27BBBBB1111B1Z5');
    expect(n.subtotal).toBe(1000);
  });
  it('blocks returning more quantity than billed', () => {
    const n = buildNoteFromInvoice(inv, 'Credit Note', CO, [], [], '2026-10-20');
    const bad = computeNote({ ...n, reason: '01-Sales Return', items: [{ ...n.items[0], quantity: 11 }] });
    const r = validateNote(bad, inv, CO, []);
    expect(r.itemErrors[n.items[0].id]).toMatch(/cannot exceed 10/);
  });
  it('requires a GST reason', () => {
    const n = buildNoteFromInvoice(inv, 'Credit Note', CO, [], [], '2026-10-20');
    expect(validateNote(n, inv, CO, []).errors.join()).toMatch(/reason/);
  });
  it('counts earlier credit notes against the billed quantity', () => {
    const n = computeNote({ ...buildNoteFromInvoice(inv, 'Credit Note', CO, [], [], '2026-10-20'), reason: '01-Sales Return' });
    n.items[0].quantity = 6; saveNote(computeNote(n));
    const second = buildNoteFromInvoice(inv, 'Credit Note', CO, [], loadNotes(), '2026-10-21');
    expect(second.noteNumber).toBe('CN-2026-002');
    const s2 = computeNote({ ...second, reason: '01-Sales Return', items: [{ ...second.items[0], quantity: 5 }] });
    expect(validateNote(s2, inv, CO, loadNotes()).errors.length).toBeGreaterThan(0);
  });
  it('stores notes under hisaaboo_credit_debit_notes and never changes the invoice', () => {
    const before = JSON.stringify(inv);
    saveNote(computeNote({ ...buildNoteFromInvoice(inv, 'Debit Note', CO, [], [], '2026-10-20'), reason: '07-Others' }));
    expect(JSON.parse(localStorage.getItem(NOTES_KEY)!)).toHaveLength(1);
    expect(nextNoteNumber('Debit Note', '2026-11-01', loadNotes())).toBe('DN-2026-002');
    expect(JSON.stringify(inv)).toBe(before);
  });
  it('GSTR-3B 3.1(a) net = gross − credit notes + debit notes; GSTR-1 JSON has cdnr', () => {
    const cn = computeNote({ ...buildNoteFromInvoice(inv, 'Credit Note', CO, [], [], '2026-10-20'), reason: '01-Sales Return' });
    cn.items[0].quantity = 2; const c = computeNote(cn);
    const r = outwardNet([inv], [c], CO, '2026-10');
    expect(r.gross.taxable).toBe(1000); expect(r.credit.taxable).toBe(200); expect(r.net.taxable).toBe(800);
    const j = buildGstr1Json([inv], CO, 2026, 10, [c]).json;
    expect(j.cdnr[0].nt[0]).toMatchObject({ ntty: 'C', nt_num: 'CN-2026-001', val: 236 });
  });
});
