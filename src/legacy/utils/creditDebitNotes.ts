// @ts-nocheck -- loosely typed like the rest of src/legacy
// Credit / Debit Notes (Sec 34 CGST Act, Rule 53). Browser-local only.
// Invoices are only ever read here — adjustments live exclusively inside notes.
import { useEffect, useState } from 'react';
import { calculateProductGst, isInterState } from './gstReports';
import { roundTo2, generateId } from './storage';

export const NOTES_KEY = 'hisaaboo_credit_debit_notes';
const CHANGE_EVENT = 'hisaaboo-notes-changed';

export const NOTE_REASONS = [
  '01-Sales Return',
  '02-Post Sale Discount',
  '03-Deficiency in Services',
  '04-Correction in Invoice',
  '05-Change in POS',
  '06-Finalization of Provisional Assessment',
  '07-Others',
];

export const STATE_NAMES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};
export const stateLabel = (code) => (code ? `${code}-${STATE_NAMES[code] || 'State'}` : '—');

const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}$/;
export const B2CL_LIMIT = 250000;

// ─── Storage ──────────────────────────────────────────────────────────────────
export function loadNotes() {
  try { const raw = localStorage.getItem(NOTES_KEY); const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function writeNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function saveNote(note) {
  const all = loadNotes();
  const i = all.findIndex(n => n.id === note.id);
  if (i >= 0) all[i] = note; else all.push(note);
  writeNotes(all);
}
export function deleteNote(id) { writeNotes(loadNotes().filter(n => n.id !== id)); }

/** Live list of notes; updates whenever any screen saves or deletes a note. */
export function useNotes() {
  const [notes, setNotes] = useState(loadNotes);
  useEffect(() => {
    const on = () => setNotes(loadNotes());
    window.addEventListener(CHANGE_EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(CHANGE_EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return notes;
}

// ─── Numbering ────────────────────────────────────────────────────────────────
export function nextNoteNumber(noteType, date, notes = loadNotes()) {
  const prefix = noteType === 'Debit Note' ? 'DN' : 'CN';
  const year = String(date || new Date().toISOString()).slice(0, 4);
  const stem = `${prefix}-${year}-`;
  const max = notes.filter(n => String(n.noteNumber).startsWith(stem))
    .reduce((m, n) => Math.max(m, parseInt(String(n.noteNumber).slice(stem.length), 10) || 0), 0);
  return stem + String(max + 1).padStart(3, '0');
}

// ─── Calculation ──────────────────────────────────────────────────────────────
export function computeItem(item, inter) {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const rate = Number(item.gstPercent) || 0;
  const taxableAmount = roundTo2(quantity * unitPrice);
  const gst = roundTo2(taxableAmount * rate / 100);
  const igstAmount = inter ? gst : 0;
  const cgstAmount = inter ? 0 : roundTo2(gst / 2);
  const sgstAmount = inter ? 0 : roundTo2(gst - cgstAmount);
  return { ...item, quantity, unitPrice, gstPercent: rate, taxableAmount, cgstAmount, sgstAmount, igstAmount, totalAmount: roundTo2(taxableAmount + gst) };
}

export function computeNote(note) {
  const items = (note.items || []).map(i => computeItem(i, note.isInterState));
  const sum = (k) => roundTo2(items.reduce((s, i) => s + (i[k] || 0), 0));
  const subtotal = sum('taxableAmount');
  const cgstTotal = sum('cgstAmount'), sgstTotal = sum('sgstAmount'), igstTotal = sum('igstAmount');
  const totalGst = roundTo2(cgstTotal + sgstTotal + igstTotal);
  return { ...note, items, subtotal, cgstTotal, sgstTotal, igstTotal, totalGst, grandTotal: roundTo2(subtotal + totalGst) };
}

/** Original invoice lines expressed in taxable (pre-GST) terms. */
export function invoiceLines(invoice, companyGstin) {
  const inter = isInterState(companyGstin, invoice.customer?.gstNumber || '');
  return (invoice.products || []).map(p => {
    const g = calculateProductGst(p, invoice.gstMode || 'inclusive', inter);
    const qty = Number(p.quantity) || 0;
    return {
      sourceItemId: p.id, description: p.name || p.description || 'Item', hsn: p.hsnSacCode || '', unit: p.unit || 'piece',
      quantity: qty, gstPercent: Number(p.gstPercent) || 0,
      unitPrice: qty ? roundTo2(g.taxableAmount / qty) : roundTo2(g.taxableAmount), taxableAmount: roundTo2(g.taxableAmount),
    };
  });
}

export function invoiceTaxable(invoice, companyGstin) {
  return roundTo2(invoiceLines(invoice, companyGstin).reduce((s, l) => s + l.taxableAmount, 0));
}

/** New note pre-filled from a finalized invoice. */
export function buildNoteFromInvoice(invoice, noteType, companyGstin, customers = [], notes = loadNotes(), today = new Date().toISOString().slice(0, 10)) {
  const gstin = String(invoice.customer?.gstNumber || '').trim().toUpperCase();
  const inter = isInterState(companyGstin, gstin);
  const pos = (GSTIN_RE.test(gstin) ? gstin : String(companyGstin || '')).slice(0, 2);
  const cust = customers.find(c => c.name?.trim().toLowerCase() === invoice.customer?.name?.trim().toLowerCase() && (!gstin || (c.gstNumber || '').toUpperCase() === gstin));
  const isCredit = noteType === 'Credit Note';
  return computeNote({
    id: generateId(),
    noteNumber: nextNoteNumber(noteType, today, notes),
    noteType, date: today,
    originalInvoiceId: invoice.id, originalInvoiceNumber: invoice.invoiceNumber, originalInvoiceDate: invoice.date,
    reason: '',
    customerId: cust?.id || '', customerName: invoice.customer?.name || '', customerGstin: gstin || undefined,
    customerAddress: invoice.customer?.billingAddress || '', customerState: pos ? STATE_NAMES[pos] || '' : '',
    placeOfSupply: pos, isInterState: inter,
    items: invoiceLines(invoice, companyGstin).map(l => ({ ...l, id: generateId(), quantity: isCredit ? l.quantity : 0 })),
    remarks: '', createdAt: new Date().toISOString(),
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────
/** Returns { errors: string[], itemErrors: {[itemId]: string} }. Credit notes are capped by what was billed minus earlier credit notes. */
export function validateNote(note, invoice, companyGstin, notes = loadNotes()) {
  const errors = [];
  const itemErrors = {};
  if (!note.reason || !NOTE_REASONS.includes(note.reason)) errors.push('Select the GST reason for issuing this note.');
  if (!note.date) errors.push('Note date is required.');
  if (!invoice) { errors.push('Select the original invoice.'); return { errors, itemErrors }; }
  if (invoice.status === 'Draft') errors.push('Notes can only be issued against a finalized invoice.');
  if (note.date && invoice.date && note.date < String(invoice.date).slice(0, 10)) errors.push('Note date cannot be before the original invoice date.');
  const invGstin = String(invoice.customer?.gstNumber || '').trim().toUpperCase();
  const noteGstin = String(note.customerGstin || '').trim().toUpperCase();
  if (invGstin !== noteGstin) errors.push('Customer GSTIN must match the original invoice.');
  if (noteGstin && !GSTIN_RE.test(noteGstin)) errors.push(`Customer GSTIN "${noteGstin}" is invalid.`);
  const expectedPos = (GSTIN_RE.test(invGstin) ? invGstin : String(companyGstin || '')).slice(0, 2);
  if (note.reason !== '05-Change in POS' && expectedPos && note.placeOfSupply !== expectedPos) errors.push('Place of supply must match the original invoice.');

  const active = (note.items || []).filter(i => (Number(i.quantity) || 0) !== 0 || (Number(i.unitPrice) || 0) !== 0);
  if (!active.length) errors.push('Add at least one item with a quantity and amount.');
  for (const i of note.items || []) {
    if ((Number(i.quantity) || 0) < 0 || (Number(i.unitPrice) || 0) < 0) itemErrors[i.id] = 'Negative values are not allowed.';
    else if (active.includes(i) && !String(i.description || '').trim()) itemErrors[i.id] = 'Description is required.';
  }

  if (note.noteType === 'Credit Note') {
    const lines = invoiceLines(invoice, companyGstin);
    const earlier = notes.filter(n => n.id !== note.id && n.noteType === 'Credit Note' && n.originalInvoiceId === invoice.id);
    for (const i of note.items || []) {
      if (itemErrors[i.id]) continue;
      const src = lines.find(l => l.sourceItemId === i.sourceItemId);
      if (!src) { if (active.includes(i)) itemErrors[i.id] = 'Credit note lines must come from the original invoice.'; continue; }
      const usedQty = earlier.reduce((s, n) => s + (n.items || []).filter(x => x.sourceItemId === i.sourceItemId).reduce((a, x) => a + (Number(x.quantity) || 0), 0), 0);
      const usedVal = earlier.reduce((s, n) => s + (n.items || []).filter(x => x.sourceItemId === i.sourceItemId).reduce((a, x) => a + (Number(x.taxableAmount) || 0), 0), 0);
      const qtyLeft = roundTo2(src.quantity - usedQty);
      const valLeft = roundTo2(src.taxableAmount - usedVal);
      const c = computeItem(i, note.isInterState);
      if (c.quantity > qtyLeft + 1e-9) itemErrors[i.id] = `Quantity cannot exceed ${qtyLeft} (billed ${src.quantity}${usedQty ? `, ${roundTo2(usedQty)} already credited` : ''}).`;
      else if (c.taxableAmount > valLeft + 0.01) itemErrors[i.id] = `Taxable value cannot exceed ₹${valLeft.toFixed(2)} for this item.`;
    }
    const totalLeft = roundTo2(invoiceTaxable(invoice, companyGstin) - earlier.reduce((s, n) => s + (n.subtotal || 0), 0));
    if (computeNote(note).subtotal > totalLeft + 0.01) errors.push(`Total taxable value cannot exceed ₹${totalLeft.toFixed(2)} still open on the original invoice.`);
  }
  if (Object.keys(itemErrors).length) errors.push('Fix the highlighted item lines.');
  return { errors, itemErrors };
}

/** Rule 53 / Sec 34(2): credit notes must be issued by 30 Nov after FY end (or annual return date, if earlier). */
export function creditNoteDeadline(invoiceDate) {
  const d = new Date(invoiceDate);
  if (isNaN(d)) return '';
  const fyEnd = d.getMonth() >= 3 ? d.getFullYear() + 1 : d.getFullYear();
  return `${fyEnd}-11-30`;
}

// ─── Reporting helpers ────────────────────────────────────────────────────────
export const signOf = (note) => (note.noteType === 'Credit Note' ? -1 : 1);
const reasonCode = (r) => String(r || '').slice(0, 2);

/** GSTR-1 Table 9B rows. CDNR = registered; CDNUR = unregistered inter-state against invoice > ₹2.5 lakh; rest adjust B2CS. */
export function classifyNote(note, invoices = []) {
  const gstin = String(note.customerGstin || '').trim().toUpperCase();
  if (gstin && GSTIN_RE.test(gstin)) return 'CDNR';
  const inv = invoices.find(i => i.id === note.originalInvoiceId);
  if (note.isInterState && (inv?.grandTotal || 0) > B2CL_LIMIT) return 'CDNUR';
  return 'B2CS';
}

export function notesInRange(notes, startDate, endDate) {
  return notes.filter(n => n.date >= String(startDate).slice(0, 10) && n.date <= String(endDate).slice(0, 10));
}

export function gstr1NoteEntries(notes, invoices = []) {
  const toEntry = (n) => ({
    noteNo: n.noteNumber, noteDate: n.date, noteType: n.noteType === 'Credit Note' ? 'C' : 'D',
    customerGstin: n.customerGstin || '', customerName: n.customerName,
    originalInvoiceNo: n.originalInvoiceNumber, originalInvoiceDate: n.originalInvoiceDate,
    taxableValue: n.subtotal, igst: n.igstTotal, cgst: n.cgstTotal, sgst: n.sgstTotal, totalGst: n.totalGst,
    reason: n.reason, reasonCode: reasonCode(n.reason), category: classifyNote(n, invoices), placeOfSupply: n.placeOfSupply,
  });
  const sorted = [...notes].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    creditNotes: sorted.filter(n => n.noteType === 'Credit Note').map(toEntry),
    debitNotes: sorted.filter(n => n.noteType === 'Debit Note').map(toEntry),
  };
}

/** Outward taxable supplies for GSTR-3B 3.1(a) for a month: gross invoices − credit notes + debit notes. */
export function outwardNet(invoices, notes, companyGstin, ym) {
  const z = () => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0 });
  const gross = z(), cn = z(), dn = z();
  for (const inv of invoices) {
    if (inv.status === 'Draft' || String(inv.date).slice(0, 7) !== ym) continue;
    const inter = isInterState(companyGstin, inv.customer?.gstNumber || '');
    for (const p of inv.products || []) {
      if (!(Number(p.gstPercent) > 0)) continue;
      const g = calculateProductGst(p, inv.gstMode || 'inclusive', inter);
      gross.taxable += g.taxableAmount; gross.igst += g.igst; gross.cgst += g.cgst; gross.sgst += g.sgst;
    }
  }
  for (const n of notes) {
    if (String(n.date).slice(0, 7) !== ym) continue;
    const t = n.noteType === 'Credit Note' ? cn : dn;
    for (const i of n.items || []) {
      if (!(Number(i.gstPercent) > 0)) continue;
      t.taxable += i.taxableAmount; t.igst += i.igstAmount; t.cgst += i.cgstAmount; t.sgst += i.sgstAmount;
    }
  }
  const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, roundTo2(v)]));
  const net = Object.fromEntries(Object.keys(gross).map(k => [k, roundTo2(gross[k] - cn[k] + dn[k])]));
  return { gross: r(gross), credit: r(cn), debit: r(dn), net };
}

/** Customer khata entries: credit notes reduce dues (credit), debit notes add (debit). */
export function noteLedgerEntries(notes) {
  return notes.map(n => ({
    date: n.date,
    particular: `${n.noteType} · ${n.reason.slice(3)} · against ${n.originalInvoiceNumber}`,
    invoiceNumber: n.noteNumber,
    debit: n.noteType === 'Debit Note' ? n.grandTotal : 0,
    credit: n.noteType === 'Credit Note' ? n.grandTotal : 0,
    type: n.noteType === 'Credit Note' ? 'creditNote' : 'debitNote',
  }));
}

export function notesForCustomer(notes, invoices) {
  const ids = new Set(invoices.map(i => i.id));
  return notes.filter(n => ids.has(n.originalInvoiceId));
}
