// @ts-nocheck -- loosely typed like the rest of src/legacy
import * as XLSX from 'xlsx';

export const GSTR2B_MAX_FILE_BYTES = 15 * 1024 * 1024;

export type Gstr2bField =
  | 'supplierGstin' | 'supplierName' | 'docNumber' | 'docType' | 'noteType' | 'docDate'
  | 'docValue' | 'pos' | 'reverseCharge' | 'taxable' | 'igst' | 'cgst' | 'sgst' | 'cess'
  | 'itcAvailability' | 'reason' | 'period' | 'filingDate';

export const FIELD_LABELS: Record<Gstr2bField, string> = {
  supplierGstin: 'Supplier GSTIN',
  supplierName: 'Supplier Name',
  docNumber: 'Document No.',
  docType: 'Document Type',
  noteType: 'Note Type',
  docDate: 'Document Date',
  docValue: 'Document Value',
  pos: 'Place of Supply',
  reverseCharge: 'Reverse Charge',
  taxable: 'Taxable Value',
  igst: 'IGST',
  cgst: 'CGST',
  sgst: 'SGST/UTGST',
  cess: 'Cess',
  itcAvailability: 'ITC Availability',
  reason: 'Reason',
  period: 'Supplier Filing Period',
  filingDate: 'Supplier Filing Date',
};

const NUMERIC_FIELDS: Gstr2bField[] = ['docValue', 'taxable', 'igst', 'cgst', 'sgst', 'cess'];

// Order matters: first match wins for a column.
const FIELD_PATTERNS: [Gstr2bField, RegExp][] = [
  ['supplierGstin', /gstin/i],
  ['supplierName', /trade|legal name|name of (the )?(supplier|isd)/i],
  ['itcAvailability', /itc\s*(availability|eligibility|available)/i],
  ['reason', /reason/i],
  ['filingDate', /filing date/i],
  ['period', /period/i],
  ['noteType', /note type|document type.*(credit|debit)/i],
  ['docType', /(invoice|note|document|supply)\s*type|isd document type/i],
  ['docNumber', /(invoice|note|document|bill of entry|boe)\s*(number|no)/i],
  ['docDate', /(invoice|note|document|bill of entry|boe)?\s*date/i],
  ['taxable', /taxable value/i],
  ['igst', /integrated tax|\bigst\b/i],
  ['cgst', /central tax|\bcgst\b/i],
  ['sgst', /state\s*\/?\s*ut tax|\bsgst\b|utgst/i],
  ['cess', /cess/i],
  ['docValue', /(invoice|note|document)?\s*value/i],
  ['pos', /place of supply/i],
  ['reverseCharge', /reverse charge/i],
];

const SUMMARY_SHEET_RE = /^itc\s*(available|not\s*available|reversal|rejected)/i;
const SKIP_SHEET_RE = /^read\s*me|^readme|instruction|^help/i;
const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/i;

export interface Gstr2bRecord {
  id: string;
  sheet: string;
  category: string;
  sourceRow: number; // 1-based excel row
  fields: Partial<Record<Gstr2bField, string>>; // displayed source text
  values: { docValue: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number };
  sign: 1 | -1; // -1 for credit notes
  raw: { label: string; value: string }[];
}

export interface Gstr2bSheet {
  name: string;
  category: string;
  kind: 'original' | 'amendment' | 'reversal' | 'rejected';
  columns: Gstr2bField[];
  records: Gstr2bRecord[];
  totals: { taxable: number; igst: number; cgst: number; sgst: number; cess: number };
}

export interface Gstr2bSummaryLine {
  sheet: string;
  heading: string;
  table: string;
  igst: number | null;
  cgst: number | null;
  sgst: number | null;
  cess: number | null;
  advisory: string;
  isGroup: boolean;
}

export interface Gstr2bReconciliation {
  summarySheet: string;
  heading: string;
  sourceSheet: string;
  reported: { igst: number; cgst: number; sgst: number; cess: number };
  calculated: { igst: number; cgst: number; sgst: number; cess: number };
  matches: boolean;
}

export interface Gstr2bResult {
  fileName: string;
  meta: { gstin?: string; legalName?: string; tradeName?: string; financialYear?: string; taxPeriod?: string; generatedOn?: string };
  sheets: Gstr2bSheet[];
  summaries: Gstr2bSummaryLine[];
  skippedSheets: { name: string; reason: string }[];
  reconciliations: Gstr2bReconciliation[];
  headline: {
    records: number;
    taxable: number; igst: number; cgst: number; sgst: number; cess: number;
    itcYes: { igst: number; cgst: number; sgst: number; cess: number };
    itcNotYes: { igst: number; cgst: number; sgst: number; cess: number; count: number };
  };
  warnings: string[];
}

export class Gstr2bError extends Error {}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());

export function toNumber(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = str(v).replace(/[₹,\s]/g, '');
  if (!s || s === '-') return 0;
  const neg = /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[()]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function categoryFor(sheetName: string) {
  const n = sheetName.trim().toUpperCase().replace(/\s+/g, ' ');
  const isReversal = /ITC REVERSAL/.test(n);
  const isRejected = /REJECTED/.test(n);
  const isAmend = /^(B2BA|B2B-CDNRA|B2B CDNRA|CDNRA|ECOA|ISDA|IMPGA|IMPGSEZA)\b/.test(n) || /AMENDMENT/.test(n);
  const kind = isRejected ? 'rejected' : isReversal ? 'reversal' : isAmend ? 'amendment' : 'original';
  let category = sheetName.trim();
  if (/^B2B-?\s*CDNRA/.test(n)) category = 'Credit/Debit Notes (Amendment)';
  else if (/^B2B-?\s*CDNR/.test(n)) category = 'Credit/Debit Notes';
  else if (/^B2BA/.test(n)) category = 'B2B Invoices (Amendment)';
  else if (/^B2B/.test(n)) category = 'B2B Invoices';
  else if (/^ECOA/.test(n)) category = 'E-commerce Supplies (Amendment)';
  else if (/^ECO/.test(n)) category = 'E-commerce Supplies';
  else if (/^ISDA/.test(n)) category = 'ISD Credits (Amendment)';
  else if (/^ISD/.test(n)) category = 'ISD Credits';
  else if (/^IMPGSEZ/.test(n)) category = 'Import of Goods from SEZ';
  else if (/^IMPG/.test(n)) category = 'Import of Goods';
  if (isReversal && !/reversal/i.test(category)) category += ' (ITC Reversal)';
  return { category, kind };
}

function isHeaderish(row: unknown[]) {
  let hits = 0;
  for (const c of row) {
    const s = str(c);
    if (!s || s.length > 80) continue;
    if (FIELD_PATTERNS.some(([, re]) => re.test(s))) hits++;
  }
  return hits;
}

function looksLikeData(row: unknown[]) {
  return row.some((c) => typeof c === 'number' || c instanceof Date || GSTIN_RE.test(str(c)));
}

function buildLabels(rows: unknown[][], start: number, end: number, width: number) {
  const labels: string[] = [];
  const filled: string[][] = [];
  for (let r = start; r < end; r++) {
    const row = rows[r] || [];
    let last = '';
    const out: string[] = [];
    for (let c = 0; c < width; c++) {
      const s = str(row[c]);
      if (s) last = s;
      // forward-fill group headers (merged cells) only for non-final header rows
      out.push(s || (r < end - 1 ? last : ''));
    }
    filled.push(out);
  }
  for (let c = 0; c < width; c++) {
    const parts: string[] = [];
    for (const f of filled) if (f[c] && !parts.includes(f[c])) parts.push(f[c]);
    labels.push(parts.join(' › '));
  }
  return labels;
}

function mapColumns(labels: string[]) {
  const map: Partial<Record<Gstr2bField, number>> = {};
  const candidates: Partial<Record<Gstr2bField, number[]>> = {};
  labels.forEach((label, idx) => {
    if (!label) return;
    // match on the most specific (last) part first
    const parts = label.split(' › ');
    const leaf = parts[parts.length - 1];
    let field = FIELD_PATTERNS.find(([, re]) => re.test(leaf))?.[0];
    if (!field) field = FIELD_PATTERNS.find(([, re]) => re.test(label))?.[0];
    if (!field) return;
    (candidates[field] ||= []).push(idx);
  });
  for (const [field, idxs] of Object.entries(candidates)) {
    const revised = idxs.filter((i) => /revised/i.test(labels[i]));
    const nonOriginal = idxs.filter((i) => !/original/i.test(labels[i]));
    map[field] = (revised[0] ?? nonOriginal[0] ?? idxs[0]);
  }
  return map;
}

function parseDetailSheet(name: string, ws: XLSX.WorkSheet) {
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
  const fmtRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });
  const width = rawRows.reduce((m, r) => Math.max(m, r.length), 0);
  let headerStart = -1;
  for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
    if (isHeaderish(rawRows[r]) >= 2) { headerStart = r; break; }
  }
  if (headerStart < 0) return null;
  let dataStart = headerStart + 1;
  while (dataStart < rawRows.length && dataStart - headerStart < 4 && !looksLikeData(rawRows[dataStart])) {
    if (rawRows[dataStart].every((c) => !str(c))) break;
    dataStart++;
  }
  // a group-title row above the header (e.g. "Original details / Revised details")
  let labelStart = headerStart;
  if (headerStart > 0) {
    const above = rawRows[headerStart - 1].map(str).filter(Boolean);
    if (above.length >= 1 && above.length <= 6 && above.some((s) => /original|revised|details/i.test(s))) labelStart = headerStart - 1;
  }
  const labels = buildLabels(fmtRows, labelStart, dataStart, width);
  const map = mapColumns(labels);
  const hasTax = ['igst', 'cgst', 'sgst', 'cess', 'taxable'].some((f) => map[f] !== undefined);
  if (!hasTax || (map.supplierGstin === undefined && map.docNumber === undefined)) return null;

  const { category, kind } = categoryFor(name);
  const columns = (Object.keys(FIELD_LABELS) as Gstr2bField[]).filter((f) => map[f] !== undefined);
  const records: Gstr2bRecord[] = [];
  for (let r = dataStart; r < rawRows.length; r++) {
    const raw = rawRows[r] || [];
    const fmt = fmtRows[r] || [];
    if (raw.every((c) => !str(c))) continue;
    const first = raw.map(str).filter(Boolean)[0] || '';
    if (/^(grand\s*)?total/i.test(first)) continue;
    const idOk = (map.supplierGstin !== undefined && str(raw[map.supplierGstin])) || (map.docNumber !== undefined && str(raw[map.docNumber]));
    if (!idOk) continue;
    const fields: Record<string, string> = {};
    for (const f of columns) fields[f] = str(fmt[map[f]]);
    const values = { docValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
    for (const f of NUMERIC_FIELDS) if (map[f] !== undefined) values[f] = toNumber(raw[map[f]]);
    const typeText = `${fields.noteType || ''} ${fields.docType || ''}`;
    const sign = /credit/i.test(typeText) ? -1 : 1;
    const rawPairs = labels.map((label, i) => ({ label: label || `Column ${i + 1}`, value: str(fmt[i]) })).filter((p) => p.value);
    records.push({ id: `${name}:${r + 1}`, sheet: name, category, sourceRow: r + 1, fields, values, sign, raw: rawPairs });
  }
  const totals = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
  for (const rec of records) for (const k of Object.keys(totals)) totals[k] += rec.sign * rec.values[k];
  for (const k of Object.keys(totals)) totals[k] = round2(totals[k]);
  return { name, category, kind, columns, records, totals } as Gstr2bSheet;
}

function parseSummarySheet(name: string, ws: XLSX.WorkSheet): Gstr2bSummaryLine[] {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  let h = -1;
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    if (rows[r].some((c) => /integrated tax/i.test(str(c)))) { h = r; break; }
  }
  if (h < 0) return [];
  const header = rows[h].map(str);
  const col = (re: RegExp) => header.findIndex((s) => re.test(s));
  const ci = { igst: col(/integrated tax/i), cgst: col(/central tax/i), sgst: col(/state/i), cess: col(/cess/i), table: col(/gstr-?3b|table/i), adv: col(/advisory/i), heading: col(/heading|description|particular/i) };
  const lines: Gstr2bSummaryLine[] = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !str(c))) continue;
    const taxCells = [ci.igst, ci.cgst, ci.sgst, ci.cess].map((i) => (i >= 0 ? row[i] : ''));
    const numeric = taxCells.some((c) => str(c) !== '' && !Number.isNaN(toNumber(c)) && /[0-9]/.test(str(c)));
    let heading = ci.heading >= 0 ? str(row[ci.heading]) : '';
    if (!heading) {
      const firstTax = Math.min(...[ci.igst, ci.cgst, ci.sgst, ci.cess, ci.table].filter((i) => i >= 0));
      heading = row.slice(0, firstTax).map(str).filter(Boolean).join(' ');
    }
    if (!heading) continue;
    const n = (i: number) => (i >= 0 && /[0-9]/.test(str(row[i])) ? toNumber(row[i]) : null);
    lines.push({
      sheet: name, heading, table: ci.table >= 0 ? str(row[ci.table]) : '',
      igst: n(ci.igst), cgst: n(ci.cgst), sgst: n(ci.sgst), cess: n(ci.cess),
      advisory: ci.adv >= 0 ? str(row[ci.adv]) : '', isGroup: !numeric,
    });
  }
  return lines;
}

function parseMeta(wb: XLSX.WorkBook) {
  const meta: Gstr2bResult['meta'] = {};
  const want: [keyof Gstr2bResult['meta'], RegExp][] = [
    ['financialYear', /financial year/i], ['taxPeriod', /tax period|return period/i], ['gstin', /^gstin\b/i],
    ['legalName', /legal name/i], ['tradeName', /trade name/i], ['generatedOn', /date of generation|generated on/i],
  ];
  const order = [...wb.SheetNames].sort((a, b) => (SKIP_SHEET_RE.test(b) ? 1 : 0) - (SKIP_SHEET_RE.test(a) ? 1 : 0));
  for (const name of order) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    for (const row of rows.slice(0, 15)) {
      for (let c = 0; c < row.length; c++) {
        const s = str(row[c]);
        if (!s) continue;
        for (const [key, re] of want) {
          if (meta[key] || !re.test(s)) continue;
          const inline = s.split(/[:\-–]\s*/).slice(1).join('-').trim();
          const next = row.slice(c + 1).map(str).find(Boolean);
          const val = next || inline;
          if (val && !re.test(val) && (key !== 'gstin' || GSTIN_RE.test(val))) meta[key] = val;
        }
      }
    }
  }
  if (meta.gstin) meta.gstin = meta.gstin.toUpperCase();
  return meta;
}

function reconcile(summaries: Gstr2bSummaryLine[], sheets: Gstr2bSheet[]): Gstr2bReconciliation[] {
  const out: Gstr2bReconciliation[] = [];
  const bySheet = (re: RegExp) => sheets.find((s) => re.test(s.name.toUpperCase().replace(/\s+/g, '')));
  const rules: [RegExp, RegExp, ((r: Gstr2bRecord) => boolean)?][] = [
    [/^b2b\s*-\s*invoices\s*$/i, /^B2B$/],
    [/^b2b\s*-\s*invoices\s*\(amendment\)/i, /^B2BA$/],
    [/^b2b\s*-\s*debit notes\s*$/i, /^B2B-?CDNR$/, (r) => r.sign === 1],
    [/^b2b\s*-\s*credit notes\s*$/i, /^B2B-?CDNR$/, (r) => r.sign === -1],
    [/^import of goods from sez/i, /^IMPGSEZ$/],
    [/^import of goods from overseas/i, /^IMPG$/],
    [/^isd\s*-\s*invoices\s*$/i, /^ISD$/],
  ];
  for (const line of summaries) {
    if (line.isGroup || !/itc available/i.test(line.sheet)) continue;
    for (const [hre, sre, pred] of rules) {
      if (!hre.test(line.heading)) continue;
      const sheet = bySheet(sre);
      if (!sheet) break;
      const calc = { igst: 0, cgst: 0, sgst: 0, cess: 0 };
      for (const r of sheet.records) {
        if (pred && !pred(r)) continue;
        if (sheet.columns.includes('itcAvailability') && !/^yes/i.test(r.fields.itcAvailability || '')) continue;
        const sign = pred ? 1 : r.sign;
        for (const k of Object.keys(calc)) calc[k] += sign * r.values[k];
      }
      for (const k of Object.keys(calc)) calc[k] = round2(Math.abs(calc[k]));
      const reported = { igst: Math.abs(line.igst || 0), cgst: Math.abs(line.cgst || 0), sgst: Math.abs(line.sgst || 0), cess: Math.abs(line.cess || 0) };
      const matches = Object.keys(calc).every((k) => Math.abs(calc[k] - reported[k]) <= 1);
      out.push({ summarySheet: line.sheet, heading: line.heading, sourceSheet: sheet.name, reported, calculated: calc, matches });
      break;
    }
  }
  return out;
}

export function parseGstr2bWorkbook(data: ArrayBuffer, fileName = 'GSTR-2B.xlsx'): Gstr2bResult {
  if (!/\.xlsx$/i.test(fileName)) throw new Gstr2bError('Please upload an .xlsx file downloaded from the GST Portal.');
  if (data.byteLength === 0) throw new Gstr2bError('The file is empty.');
  if (data.byteLength > GSTR2B_MAX_FILE_BYTES) throw new Gstr2bError('The file is larger than 15 MB. Please upload the original GSTR-2B workbook.');
  const head = new Uint8Array(data.slice(0, 2));
  if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Gstr2bError('This file is not a valid Excel (.xlsx) workbook or it is corrupted.');
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: 'array', cellDates: false });
  } catch {
    throw new Gstr2bError('This workbook could not be read. It may be corrupted or password-protected.');
  }
  const sheets: Gstr2bSheet[] = [];
  const summaries: Gstr2bSummaryLine[] = [];
  const skippedSheets: { name: string; reason: string }[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (SKIP_SHEET_RE.test(name.trim())) continue;
    if (SUMMARY_SHEET_RE.test(name.trim())) {
      const lines = parseSummarySheet(name, ws);
      if (lines.length) summaries.push(...lines);
      else skippedSheets.push({ name, reason: 'Summary layout not recognised' });
      continue;
    }
    const parsed = parseDetailSheet(name, ws);
    if (parsed) sheets.push(parsed);
    else skippedSheets.push({ name, reason: 'No GSTR-2B table header found' });
  }
  const meta = parseMeta(wb);
  const looksLike2b = summaries.length > 0 || sheets.some((s) => /^(B2B|B2BA|B2B-?CDNRA?|ECOA?|ISDA?|IMPG|IMPGSEZ)\b/i.test(s.name.trim()));
  if (!looksLike2b) {
    throw new Gstr2bError('This does not look like a GSTR-2B workbook from the GST Portal. Please upload the original file without renaming its sheets.');
  }
  const headline = {
    records: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0,
    itcYes: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    itcNotYes: { igst: 0, cgst: 0, sgst: 0, cess: 0, count: 0 },
  };
  for (const s of sheets) {
    headline.records += s.records.length;
    if (s.kind !== 'original') continue; // amendments/reversals/rejected shown separately, never added
    for (const r of s.records) {
      headline.taxable += r.sign * r.values.taxable;
      for (const k of ['igst', 'cgst', 'sgst', 'cess']) headline[k] += r.sign * r.values[k];
      if (!s.columns.includes('itcAvailability')) continue;
      const bucket = /^yes/i.test(r.fields.itcAvailability || '') ? headline.itcYes : headline.itcNotYes;
      for (const k of ['igst', 'cgst', 'sgst', 'cess']) bucket[k] += r.sign * r.values[k];
      if (bucket === headline.itcNotYes) headline.itcNotYes.count++;
    }
  }
  const roundObj = (o) => { for (const k of Object.keys(o)) if (k !== 'count' && typeof o[k] === 'number') o[k] = round2(o[k]); };
  roundObj(headline); roundObj(headline.itcYes); roundObj(headline.itcNotYes);
  const warnings: string[] = [];
  if (!meta.gstin) warnings.push('GSTIN was not found in the workbook.');
  if (!meta.taxPeriod) warnings.push('Tax period was not found in the workbook.');
  if (!summaries.length) warnings.push('No ITC summary sheets were found, so totals cannot be cross-checked.');
  return { fileName, meta, sheets, summaries, skippedSheets, reconciliations: reconcile(summaries, sheets), headline, warnings };
}
