// @ts-nocheck -- loosely typed like the rest of src/legacy
// GSTR-3B preparation working report built from a parsed GSTR-2B result plus user-entered figures.
// Pure functions only: nothing here reads or writes app storage.
import type { Gstr2bResult } from './gstr2b';

export type Head = 'taxable' | 'igst' | 'cgst' | 'sgst' | 'cess';
export type Amounts = Partial<Record<Head, number | null>>;
export type Origin = 'imported' | 'user' | 'calculated';

export interface Gstr3bRow {
  key: string;
  table: string;
  description: string;
  heads: Head[];
  values: Amounts; // null => information required
  origin: Origin;
  source: string;
  method: string;
  review: boolean;
  missing: boolean;
  reference?: { label: string; values: Amounts };
}

export interface Gstr3bInputs {
  [key: string]: Amounts | undefined;
}

export const TAX_HEADS: Head[] = ['igst', 'cgst', 'sgst', 'cess'];
const round2 = (n: number) => Math.round(n * 100) / 100;

// User-entered sections that GSTR-2B cannot provide.
export const USER_FIELDS: { key: string; table: string; description: string; heads: Head[]; hint?: string }[] = [
  { key: 'o_a', table: '3.1(a)', description: 'Outward taxable supplies (other than zero rated, nil rated and exempted)', heads: ['taxable', 'igst', 'cgst', 'sgst', 'cess'], hint: 'From your sales / GSTR-1 for this period' },
  { key: 'o_b', table: '3.1(b)', description: 'Outward taxable supplies (zero rated)', heads: ['taxable', 'igst', 'cess'] },
  { key: 'o_c', table: '3.1(c)', description: 'Other outward supplies (nil rated, exempted)', heads: ['taxable'] },
  { key: 'o_d', table: '3.1(d)', description: 'Inward supplies liable to reverse charge', heads: ['taxable', 'igst', 'cgst', 'sgst', 'cess'], hint: 'Include RCM from unregistered suppliers and services not shown in GSTR-2B' },
  { key: 'o_e', table: '3.1(e)', description: 'Non-GST outward supplies', heads: ['taxable'] },
  { key: 'itc_impS', table: '4(A)(2)', description: 'Import of services', heads: ['igst', 'cess'] },
  { key: 'rev_42', table: '4(B)(1)', description: 'ITC reversed as per Rule 38, 42 & 43 and Section 17(5)', heads: ['igst', 'cgst', 'sgst', 'cess'] },
  { key: 'rev_oth', table: '4(B)(2)', description: 'ITC reversed – others', heads: ['igst', 'cgst', 'sgst', 'cess'] },
  { key: 'inel_175', table: '4(D)(1)', description: 'Ineligible ITC under Section 16(4) & ITC restricted due to PoS rules', heads: ['igst', 'cgst', 'sgst', 'cess'] },
  { key: 'interest', table: '5.1', description: 'Interest and late fee', heads: ['igst', 'cgst', 'sgst', 'cess'] },
];

const emptyTax = () => ({ igst: 0, cgst: 0, sgst: 0, cess: 0 });

/** Sum non-group lines of ITC Available summary sheets whose GSTR-3B table column names the given table. */
function fromSummary(r: Gstr2bResult, sheetRe: RegExp, tableRe: RegExp) {
  const lines = r.summaries.filter((l) => !l.isGroup && sheetRe.test(l.sheet) && tableRe.test(l.table.replace(/\s+/g, '')));
  if (!lines.length) return null;
  const t = emptyTax();
  for (const l of lines) {
    const sign = /credit note/i.test(l.heading) ? -1 : 1;
    for (const k of TAX_HEADS) t[k] += sign * Math.abs(l[k] || 0);
  }
  for (const k of TAX_HEADS) t[k] = round2(t[k]);
  return { t, lines };
}

/** Record-level fallback: original sheets only, ITC Availability "Yes" when the column exists. */
function fromRecords(r: Gstr2bResult, sheetRe: RegExp, pred?: (rec) => boolean) {
  const sheets = r.sheets.filter((s) => s.kind === 'original' && sheetRe.test(s.name.trim().toUpperCase().replace(/\s+/g, '')));
  if (!sheets.length) return null;
  const t = emptyTax();
  for (const s of sheets) for (const rec of s.records) {
    if (s.columns.includes('itcAvailability') && !/^yes/i.test(rec.fields.itcAvailability || '')) continue;
    if (pred && !pred(rec)) continue;
    for (const k of TAX_HEADS) t[k] += rec.sign * rec.values[k];
  }
  for (const k of TAX_HEADS) t[k] = round2(t[k]);
  return { t, sheets: sheets.map((s) => s.name) };
}

const isRcm = (rec) => /^y/i.test(rec.fields.reverseCharge || '');

function itcRow(r: Gstr2bResult, key: string, table: string, description: string, tableRe: RegExp, sheetRe: RegExp, heads: Head[], pred?): Gstr3bRow {
  const s = fromSummary(r, /itc available/i, tableRe);
  if (s) return {
    key, table, description, heads, values: s.t, origin: 'imported',
    source: `${s.lines[0].sheet}: ${s.lines.map((l) => l.heading).join(', ')}`,
    method: 'Sum of GSTR-2B summary lines for this table (credit notes deducted). Includes amendments as computed by the portal.',
    review: true, missing: false,
  };
  const d = fromRecords(r, sheetRe, pred);
  if (d) return {
    key, table, description, heads, values: d.t, origin: 'calculated',
    source: `Sheets ${d.sheets.join(', ')} (ITC Availability = Yes)`,
    method: 'No summary sheet line found; calculated from original document rows, credit notes deducted. Amendments not applied.',
    review: true, missing: false,
  };
  return { key, table, description, heads, values: Object.fromEntries(heads.map((h) => [h, 0])), origin: 'imported', source: 'Not present in this GSTR-2B', method: 'No matching sheet or summary line in the workbook; treated as nil.', review: false, missing: false };
}

function userRow(f, inputs: Gstr3bInputs): Gstr3bRow {
  const v = inputs[f.key];
  const values: Amounts = {};
  let missing = false;
  for (const h of f.heads) {
    const n = v?.[h];
    values[h] = n === undefined || n === null || Number.isNaN(n) ? null : n;
    if (values[h] === null) missing = true;
  }
  return { key: f.key, table: f.table, description: f.description, heads: f.heads, values, origin: 'user', source: 'Entered by you', method: f.hint || 'Entered manually', review: false, missing };
}

const sumRows = (rows: Gstr3bRow[], heads: Head[], sign = 1) => {
  const out: Amounts = {};
  let missing = false;
  for (const h of heads) {
    let t = 0;
    for (const row of rows) {
      if (!row.heads.includes(h)) continue;
      const v = row.values[h];
      if (v === null || v === undefined) { missing = true; continue; }
      t += v;
    }
    out[h] = round2(sign * t);
  }
  return { out, missing };
};

export interface Gstr3bReport {
  sections: { title: string; rows: Gstr3bRow[] }[];
  warnings: string[];
  complete: boolean;
}

export function buildGstr3bReport(r: Gstr2bResult, inputs: Gstr3bInputs): Gstr3bReport {
  const U = Object.fromEntries(USER_FIELDS.map((f) => [f.key, userRow(f, inputs)]));
  const warnings: string[] = [];

  // RCM reference from GSTR-2B (registered suppliers only)
  const rcm2b = fromRecords(r, /^B2B$/, isRcm);
  if (rcm2b && TAX_HEADS.some((k) => rcm2b.t[k])) {
    U.o_d.reference = { label: 'GSTR-2B B2B rows with reverse charge = Yes (registered suppliers only)', values: rcm2b.t };
  }

  const outward = [U.o_a, U.o_b, U.o_c, U.o_d, U.o_e];
  const outTax = sumRows([U.o_a, U.o_b, U.o_d], TAX_HEADS);
  const outTotal: Gstr3bRow = { key: 'o_tot', table: '3.1 Total', description: 'Total tax liability (3.1 a + b + d)', heads: TAX_HEADS, values: outTax.out, origin: 'calculated', source: '3.1(a), 3.1(b), 3.1(d)', method: 'Sum of tax heads', review: outTax.missing, missing: outTax.missing };

  const a1 = itcRow(r, 'itc_impG', '4(A)(1)', 'Import of goods', /4\(A\)\(1\)/i, /^IMPG(SEZ)?$/, TAX_HEADS);
  const a2 = U.itc_impS;
  // 4(A)(3): RCM ITC — portal summary if present, else mirror of tax entered in 3.1(d)
  let a3 = itcRow(r, 'itc_rcm', '4(A)(3)', 'Inward supplies liable to reverse charge (other than 1 & 2)', /4\(A\)\(3\)/i, /^$/, TAX_HEADS);
  if (a3.source === 'Not present in this GSTR-2B') {
    const d = U.o_d;
    const missing = TAX_HEADS.some((h) => d.values[h] === null);
    a3 = { ...a3, origin: 'calculated', values: Object.fromEntries(TAX_HEADS.map((h) => [h, d.values[h]])), source: '3.1(d) as entered by you', method: 'Assumed equal to reverse-charge tax paid in 3.1(d). Reduce if any RCM credit is ineligible.', review: true, missing };
  }
  const a4 = itcRow(r, 'itc_isd', '4(A)(4)', 'Inward supplies from ISD', /4\(A\)\(4\)/i, /^ISD$/, TAX_HEADS);
  const a5 = itcRow(r, 'itc_oth', '4(A)(5)', 'All other ITC', /4\(A\)\(5\)/i, /^(B2B|B2B-?CDNR|ECO)$/, TAX_HEADS, (rec) => !isRcm(rec));
  const aRows = [a1, a2, a3, a4, a5];
  const aSum = sumRows(aRows, TAX_HEADS);
  const aTot: Gstr3bRow = { key: 'itc_a', table: '4(A) Total', description: 'ITC available (whether in full or part)', heads: TAX_HEADS, values: aSum.out, origin: 'calculated', source: '4(A)(1) to 4(A)(5)', method: 'Sum', review: true, missing: aSum.missing };

  // ITC reversal reference from GSTR-2B
  const revSheet = r.summaries.filter((l) => !l.isGroup && /itc reversal/i.test(l.sheet));
  if (revSheet.length) {
    const t = emptyTax();
    for (const l of revSheet) for (const k of TAX_HEADS) t[k] += Math.abs(l[k] || 0);
    U.rev_oth.reference = { label: `GSTR-2B "${revSheet[0].sheet}" sheet`, values: t };
  }
  const notAvail = r.summaries.filter((l) => !l.isGroup && /itc not available/i.test(l.sheet));
  if (notAvail.length) {
    const t = emptyTax();
    for (const l of notAvail) for (const k of TAX_HEADS) t[k] += (/credit note/i.test(l.heading) ? -1 : 1) * Math.abs(l[k] || 0);
    U.inel_175.reference = { label: `GSTR-2B "${notAvail[0].sheet}" sheet (not claimable, reference only)`, values: t };
  } else if (r.headline.itcNotYes.count) {
    U.inel_175.reference = { label: `${r.headline.itcNotYes.count} GSTR-2B rows marked not available (reference only)`, values: r.headline.itcNotYes };
  }

  const bSum = sumRows([U.rev_42, U.rev_oth], TAX_HEADS);
  const bTot: Gstr3bRow = { key: 'itc_b', table: '4(B) Total', description: 'ITC reversed', heads: TAX_HEADS, values: bSum.out, origin: 'calculated', source: '4(B)(1) + 4(B)(2)', method: 'Sum', review: false, missing: bSum.missing };
  const net: Amounts = {};
  for (const h of TAX_HEADS) net[h] = round2((aSum.out[h] || 0) - (bSum.out[h] || 0));
  const cRow: Gstr3bRow = { key: 'itc_c', table: '4(C)', description: 'Net ITC available (A − B)', heads: TAX_HEADS, values: net, origin: 'calculated', source: '4(A) − 4(B)', method: 'Subtraction per tax head', review: true, missing: aSum.missing || bSum.missing };

  // Indicative balance (simplified; actual set-off follows Sec 49 / Rule 88A order on the portal)
  const bal: Amounts = {};
  for (const h of TAX_HEADS) bal[h] = round2((outTax.out[h] || 0) - (net[h] || 0));
  const balRow: Gstr3bRow = { key: 'bal', table: '6.1 (indicative)', description: 'Liability less net ITC, per head (negative = excess ITC)', heads: TAX_HEADS, values: bal, origin: 'calculated', source: '3.1 Total − 4(C)', method: 'Simple per-head difference. Cross-utilisation of IGST/CGST/SGST and RCM cash payment are not applied — confirm on the GST Portal.', review: true, missing: outTax.missing || cRow.missing };

  for (const rec of r.reconciliations) if (!rec.matches) warnings.push(`GSTR-2B summary "${rec.heading}" differs from its invoice rows in sheet ${rec.sourceSheet}. Verify before using.`);
  if (!r.summaries.length) warnings.push('No ITC summary sheets found; ITC figures were calculated from document rows and amendments were not applied.');
  const amend = r.sheets.filter((s) => s.kind === 'amendment' && s.records.length);
  if (amend.length && !r.summaries.length) warnings.push(`Amendment sheets (${amend.map((s) => s.name).join(', ')}) are not included in the calculated ITC. Adjust manually.`);
  warnings.push('ITC shown as available in GSTR-2B is not final proof of eligibility (Sec 16, 17(5), payment within 180 days, etc.).');

  const sections = [
    { title: '3.1 Outward supplies and inward supplies liable to reverse charge', rows: [...outward, outTotal] },
    { title: '4. Eligible ITC', rows: [...aRows, aTot, U.rev_42, U.rev_oth, bTot, cRow, U.inel_175] },
    { title: '5.1 Interest & late fee', rows: [U.interest] },
    { title: '6.1 Payment of tax (indicative)', rows: [balRow] },
  ];
  const complete = sections.every((s) => s.rows.every((row) => !row.missing));
  return { sections, warnings, complete };
}

/** Optional, read-only: match saved purchase entries' invoice numbers (from details) to GSTR-2B documents. */
export function reconcilePurchases(r: Gstr2bResult, purchases: { supplierName?: string; details?: Record<string, string> }[]) {
  const norm = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const invOf = (p) => Object.entries(p.details || {}).find(([k]) => /invoice|bill/i.test(k))?.[1] || '';
  const docs = r.sheets.filter((s) => s.kind === 'original').flatMap((s) => s.records.map((rec) => ({ no: norm(rec.fields.docNumber), rec })));
  const docSet = new Set(docs.map((d) => d.no).filter(Boolean));
  const withInv = purchases.map((p) => ({ p, no: norm(invOf(p)) })).filter((x) => x.no);
  const purSet = new Set(withInv.map((x) => x.no));
  return {
    checked: withInv.length,
    withoutInvoiceNo: purchases.length - withInv.length,
    matched: withInv.filter((x) => docSet.has(x.no)).length,
    notIn2b: withInv.filter((x) => !docSet.has(x.no)).map((x) => ({ supplier: x.p.supplierName || '—', invoice: invOf(x.p) })),
    notInBooks: docs.filter((d) => d.no && !purSet.has(d.no)).length,
  };
}
