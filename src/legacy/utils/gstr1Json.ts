// @ts-nocheck -- Hisaaboo legacy style
// Builds a GSTR-1 JSON in the GST Portal offline-tool structure (b2b, b2cs, nil, hsn).
// Pure function: reads invoices, never modifies them.
import { calculateProductGst, isInterState } from './gstReports';
import { roundTo2 } from './storage';

export const GSTR1_SCHEMA_VERSION = 'GST3.2.1';
const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{1}[1-9A-Z]{1}[0-9A-Z]{1}$/;
const INUM_RE = /^[A-Za-z0-9/-]{1,16}$/;
const VALID_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];
const UQC = { piece: 'PCS', box: 'BOX', packet: 'PAC', strip: 'NOS', bottle: 'BTL', kg: 'KGS', gram: 'GMS', liter: 'LTR', meter: 'MTR', feet: 'OTH', bag: 'BAG', ton: 'TON', set: 'SET', service: 'NA', hour: 'NA', day: 'NA', custom: 'OTH' };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const r2 = (n) => roundTo2(n || 0);
const ddmmyyyy = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}-${m}-${y}`; };
const ymOf = (iso) => String(iso || '').slice(0, 7);

/** FY like "2026-27" + month index (0-11) → {year, month(1-12)} */
export function periodFromFy(fy: string, monthIdx: number) {
  const start = parseInt(fy.slice(0, 4), 10);
  const year = monthIdx >= 3 ? start : start + 1;
  return { year, month: monthIdx + 1 };
}

export interface Gstr1Issue { invoiceNo: string; date: string; message: string; blocking: boolean }

export function buildGstr1Json(invoices, companyGstin: string, year: number, month: number) {
  const fp = String(month).padStart(2, '0') + year;
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const gstin = String(companyGstin || '').trim().toUpperCase();
  const issues: Gstr1Issue[] = [];
  const compState = gstin.slice(0, 2);
  if (!GSTIN_RE.test(gstin)) issues.push({ invoiceNo: '—', date: '', message: 'Your company GSTIN is missing or invalid (Company Profile).', blocking: true });

  const inPeriod = invoices.filter(i => ymOf(i.date) === ym);
  const drafts = inPeriod.filter(i => i.status === 'Draft');
  const eligible = inPeriod.filter(i => i.status !== 'Draft');
  const seen = new Set();
  const b2bMap = new Map();
  const b2csMap = new Map();
  const nil = { INTRB2B: [0, 0, 0], INTRAB2B: [0, 0, 0], INTRB2C: [0, 0, 0], INTRAB2C: [0, 0, 0] }; // expt, nil, ngsup
  const hsnMap = new Map();
  const included = [];
  const excluded = [];

  for (const inv of eligible) {
    const errs = [];
    const warns = [];
    const no = String(inv.invoiceNumber || '').trim();
    if (!no) errs.push('Invoice number is missing.');
    else if (!INUM_RE.test(no)) errs.push('Invoice number must be up to 16 characters using only letters, numbers, "/" or "-".');
    if (seen.has(no.toUpperCase())) errs.push('Duplicate invoice number in this period.');
    if (!inv.products?.length) errs.push('Invoice has no items.');
    const ctin = String(inv.customer?.gstNumber || '').trim().toUpperCase();
    const isB2B = ctin.length > 0;
    if (isB2B && !GSTIN_RE.test(ctin)) errs.push(`Customer GSTIN "${ctin}" is invalid.`);
    if (isB2B && ctin === gstin) errs.push('Customer GSTIN is the same as your own GSTIN.');
    const pos = isB2B && GSTIN_RE.test(ctin) ? ctin.slice(0, 2) : compState;
    if (!isB2B) warns.push('No customer GSTIN — reported as B2C (small) with your own state as place of supply. Verify if this was an inter-state sale.');
    const inter = isB2B && isInterState(gstin, ctin);
    const items = [];
    for (const p of inv.products || []) {
      const rt = Number(p.gstPercent) || 0;
      if (!VALID_RATES.includes(rt)) errs.push(`Item "${p.name}" has an unsupported GST rate ${rt}%.`);
      const g = calculateProductGst(p, inv.gstMode || 'inclusive', inter);
      if (g.taxableAmount < 0) errs.push(`Item "${p.name}" has a negative taxable value.`);
      if (!p.hsnSacCode || !/^[0-9]{4,8}$/.test(String(p.hsnSacCode).trim())) warns.push(`Item "${p.name}" has no valid HSN/SAC code (4–8 digits).`);
      items.push({ p, rt, g });
    }
    if (errs.length) { errs.forEach(m => issues.push({ invoiceNo: no || '(blank)', date: inv.date, message: m, blocking: true })); excluded.push(inv); continue; }
    warns.forEach(m => issues.push({ invoiceNo: no, date: inv.date, message: m, blocking: false }));
    seen.add(no.toUpperCase());
    included.push(inv);

    const taxed = items.filter(x => x.rt > 0);
    const zero = items.filter(x => x.rt === 0);
    const nilKey = (inter ? 'INTRB2' : 'INTRAB2') + (isB2B ? 'B' : 'C');
    for (const x of zero) {
      const cat = x.p.gstCategory;
      const idx = cat === 'Exempt' ? 0 : cat === 'Non-GST' ? 2 : 1;
      nil[nilKey][idx] += x.g.taxableAmount;
    }
    // Rate-wise item lines
    const byRate = new Map();
    for (const x of taxed) {
      const a = byRate.get(x.rt) || { txval: 0, iamt: 0, camt: 0, samt: 0 };
      a.txval += x.g.taxableAmount; a.iamt += x.g.igst; a.camt += x.g.cgst; a.samt += x.g.sgst;
      byRate.set(x.rt, a);
    }
    if (isB2B && byRate.size) {
      const itms = [...byRate.entries()].map(([rt, a], i) => ({
        num: i + 1,
        itm_det: inter
          ? { txval: r2(a.txval), rt, iamt: r2(a.iamt), csamt: 0 }
          : { txval: r2(a.txval), rt, camt: r2(a.camt), samt: r2(a.samt), csamt: 0 },
      }));
      if (!b2bMap.has(ctin)) b2bMap.set(ctin, []);
      b2bMap.get(ctin).push({ inum: no, idt: ddmmyyyy(inv.date), val: r2(inv.grandTotal), pos, rchrg: 'N', inv_typ: 'R', itms });
    } else if (!isB2B) {
      for (const [rt, a] of byRate) {
        const k = `${pos}|${rt}`;
        const b = b2csMap.get(k) || { sply_ty: 'INTRA', pos, typ: 'OE', rt, txval: 0, camt: 0, samt: 0, csamt: 0 };
        b.txval += a.txval; b.camt += a.camt; b.samt += a.samt;
        b2csMap.set(k, b);
      }
    }
    for (const x of items) {
      const hsn = String(x.p.hsnSacCode || '').trim();
      const uqc = UQC[x.p.unit] || 'OTH';
      const k = `${hsn}|${x.rt}|${uqc}|${isB2B ? 'b2b' : 'b2c'}`;
      const h = hsnMap.get(k) || { hsn_sc: hsn, uqc, qty: 0, rt: x.rt, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0, b2b: isB2B };
      h.qty += uqc === 'NA' ? 0 : Number(x.p.quantity) || 0;
      h.txval += x.g.taxableAmount; h.iamt += x.g.igst; h.camt += x.g.cgst; h.samt += x.g.sgst;
      hsnMap.set(k, h);
    }
  }
  drafts.forEach(d => issues.push({ invoiceNo: d.invoiceNumber, date: d.date, message: 'Draft invoice — not included.', blocking: false }));

  const json: any = { gstin, fp, version: GSTR1_SCHEMA_VERSION, hash: 'hash' };
  if (b2bMap.size) json.b2b = [...b2bMap.entries()].map(([ctin, inv]) => ({ ctin, inv }));
  if (b2csMap.size) json.b2cs = [...b2csMap.values()].map(b => ({ ...b, txval: r2(b.txval), camt: r2(b.camt), samt: r2(b.samt) }));
  const nilInv = Object.entries(nil).filter(([, v]) => v.some(n => n)).map(([sply_ty, v]) => ({ sply_ty, expt_amt: r2(v[0]), nil_amt: r2(v[1]), ngsup_amt: r2(v[2]) }));
  if (nilInv.length) json.nil = { inv: nilInv };
  const hsnRows = [...hsnMap.values()].filter(h => h.hsn_sc);
  const mk = (rows) => rows.map((h, i) => ({ num: i + 1, hsn_sc: h.hsn_sc, uqc: h.uqc, qty: r2(h.qty), rt: h.rt, txval: r2(h.txval), iamt: r2(h.iamt), camt: r2(h.camt), samt: r2(h.samt), csamt: 0 }));
  const hb2b = mk(hsnRows.filter(h => h.b2b));
  const hb2c = mk(hsnRows.filter(h => !h.b2b));
  if (hb2b.length || hb2c.length) json.hsn = { ...(hb2b.length ? { hsn_b2b: hb2b } : {}), ...(hb2c.length ? { hsn_b2c: hb2c } : {}) };

  const blocking = issues.filter(i => i.blocking);
  return {
    json, fp, total: inPeriod.length, included, excluded, drafts,
    blocking, warnings: issues.filter(i => !i.blocking),
    companyBlocked: blocking.some(i => i.invoiceNo === '—'),
  };
}
