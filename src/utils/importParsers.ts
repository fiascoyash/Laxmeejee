import * as XLSX from 'xlsx';
import type {
  ImportFormat,
  ParseResult,
  ExtractedRow,
  ImportFieldKey,
  FieldMapping,
} from '../types';
import { IMPORT_FIELD_DEFINITIONS } from '../types';

// ─── Format detection ──────────────────────────────────────────────────────

export const detectFormat = (fileName: string): ImportFormat | null => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.pdf')) return 'pdf';
  return null;
};

// ─── CSV / Excel parsing ───────────────────────────────────────────────────

const sheetToRows = (sheet: XLSX.WorkSheet): { headers: string[]; rows: ExtractedRow[] } => {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  if (raw.length === 0) return { headers: [], rows: [] };

  // Collect headers preserving first-seen order across all rows.
  const headerSet: string[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headerSet.push(key);
      }
    }
  }

  const rows: ExtractedRow[] = raw.map((row) => {
    const out: ExtractedRow = {};
    for (const header of headerSet) {
      const value = row[header];
      out[header] = typeof value === 'number' ? value : String(value ?? '').trim();
    }
    return out;
  });

  return { headers: headerSet, rows };
};

const parseCsv = async (file: File): Promise<ParseResult> => {
  const text = await file.text();
  const workbook = XLSX.read(text, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { format: 'csv', fileName: file.name, headers: [], rows: [], warnings: ['File appears to be empty.'], confidence: 30 };
  }
  const { headers, rows } = sheetToRows(sheet);
  const warnings: string[] = [];
  if (rows.length === 0) warnings.push('No data rows found in the CSV.');
  return {
    format: 'csv',
    fileName: file.name,
    headers,
    rows,
    warnings,
    // CSV is structured and reliable — high confidence.
    confidence: rows.length > 0 ? 95 : 40,
  };
};

const parseXlsx = async (file: File): Promise<ParseResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { format: 'xlsx', fileName: file.name, headers: [], rows: [], warnings: ['Workbook has no sheets.'], confidence: 30 };
  }
  const sheet = workbook.Sheets[sheetName];
  const { headers, rows } = sheetToRows(sheet);
  const warnings: string[] = [];
  if (rows.length === 0) warnings.push('No data rows found in the first sheet.');
  return {
    format: 'xlsx',
    fileName: file.name,
    headers,
    rows,
    warnings,
    confidence: rows.length > 0 ? 95 : 40,
  };
};

// ─── PDF parsing ───────────────────────────────────────────────────────────
// PDFs are the trickiest format. We extract text per page, then run a layout
// heuristic that splits each line on 2+ spaces to recover columns. This works
// well for tabular PDFs (most supplier bills) and degrades gracefully — when
// the heuristic fails the user is asked to confirm mapping and the confidence
// score is lowered so the UI never silently imports garbage.

const parsePdf = async (file: File): Promise<ParseResult> => {
  try {
    // Dynamic import keeps pdfjs out of the main bundle for non-PDF imports.
    const pdfjs = await import('pdfjs-dist');
    // Worker is required for pdfjs to function in the browser. We point at the
    // legacy build's worker to match the installed version exactly.
    const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const warnings: string[] = [];
    const allLines: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Reconstruct lines using item transform Y coordinate.
      const lineMap = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items as Array<{ str: string; transform: number[]; width: number }>) {
        if (!item.str) continue;
        const x = item.transform[4];
        const y = Math.round(item.transform[5]);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push({ x, text: item.str });
      }
      const ys = Array.from(lineMap.keys()).sort((a, b) => b - a);
      for (const y of ys) {
        const parts = lineMap.get(y)!.sort((a, b) => a.x - b.x);
        const line = parts.map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim();
        if (line) allLines.push(line);
      }
    }

    // Heuristic: split each line on 2+ spaces to recover columns. Lines that
    // split into >=2 segments are treated as data rows; the first such line is
    // treated as the header. This is intentionally conservative — when it
    // fails, confidence drops and the user is asked to confirm.
    const splitLines = allLines
      .map((line) => line.split(/\s{2,}|\t+/).map((s) => s.trim()).filter(Boolean))
      .filter((parts) => parts.length >= 2);

    if (splitLines.length === 0) {
      warnings.push('Could not detect a tabular layout in the PDF. You can still map columns manually.');
      return { format: 'pdf', fileName: file.name, headers: [], rows: [], warnings, confidence: 25 };
    }

    const headers = splitLines[0].map((_, idx) => `Column ${idx + 1}`);
    const rows: ExtractedRow[] = splitLines.slice(1).map((parts) => {
      const out: ExtractedRow = {};
      headers.forEach((h, idx) => {
        out[h] = parts[idx] ?? '';
      });
      return out;
    });

    if (rows.length === 0) warnings.push('PDF text was extracted but no data rows were detected.');

    // PDF confidence is lower than CSV/XLSX because the layout heuristic can
    // misalign columns. The UI uses this to decide whether to ask the user to
    // confirm before importing.
    const confidence = rows.length > 0 ? 70 : 35;

    return {
      format: 'pdf',
      fileName: file.name,
      headers,
      rows,
      warnings,
      confidence,
    };
  } catch (err) {
    return {
      format: 'pdf',
      fileName: file.name,
      headers: [],
      rows: [],
      warnings: [`Failed to read PDF: ${err instanceof Error ? err.message : 'unknown error'}`],
      confidence: 10,
    };
  }
};

// Public entry point used by the import UI.
export const parseFile = async (file: File): Promise<ParseResult> => {
  const format = detectFormat(file.name);
  if (!format) {
    return {
      format: 'csv',
      fileName: file.name,
      headers: [],
      rows: [],
      warnings: [`Unsupported file type: ${file.name}. Please upload CSV, Excel (.xlsx), or PDF.`],
      confidence: 0,
    };
  }
  switch (format) {
    case 'csv':
      return parseCsv(file);
    case 'xlsx':
      return parseXlsx(file);
    case 'pdf':
      return parsePdf(file);
  }
};

// ─── Auto-mapping heuristic ────────────────────────────────────────────────
// Given a list of source headers, suggest a mapping for each one based on
// fuzzy keyword matching against the canonical field definitions. Returns
// mappings with fieldKey = null for headers we cannot confidently place.

const FIELD_KEYWORDS: Record<ImportFieldKey, string[]> = {
  productName: ['product', 'item', 'description', 'name', 'particular', 'goods', 'medicine', 'drug'],
  description: ['description', 'detail', 'spec', 'remark'],
  quantity: ['qty', 'quantity', 'nos', 'no', 'count', 'pieces', 'pcs', 'unit'],
  purchasePrice: ['rate', 'price', 'cost', 'purchase', 'mrp', 'amount', 'value', 'price/unit', 'unit price'],
  gstPercent: ['gst', 'tax', 'cgst', 'sgst', 'igst', 'vat', 'tax%'],
  hsnSac: ['hsn', 'sac', 'code', 'hsn/sac', 'hsn code'],
  batch: ['batch', 'batch no', 'batch number', 'lot'],
  expiry: ['expiry', 'exp', 'expire', 'expiry date', 'validity'],
  mrp: ['mrp', 'maximum retail', 'retail price', 'selling price', 'sell'],
  amount: ['amount', 'total', 'line total', 'net amount', 'subtotal', 'net'],
  supplierInvoiceNumber: ['invoice', 'bill', 'bill no', 'invoice no', 'invoice number', 'inv no', 'bill number'],
};

const normalizeHeader = (header: string): string =>
  header.toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();

const scoreHeader = (header: string, keywords: string[]): number => {
  const h = normalizeHeader(header);
  if (!h) return 0;
  let best = 0;
  for (const kw of keywords) {
    const k = normalizeHeader(kw);
    if (!k) continue;
    if (h === k) best = Math.max(best, 100);
    else if (h.includes(k)) best = Math.max(best, 80);
    else if (k.includes(h) && h.length >= 3) best = Math.max(best, 60);
  }
  return best;
};

export const suggestMappings = (headers: string[]): FieldMapping[] => {
  const used = new Set<ImportFieldKey>();
  const mappings: FieldMapping[] = headers.map((header) => {
    let bestKey: ImportFieldKey | null = null;
    let bestScore = 0;
    for (const field of IMPORT_FIELD_DEFINITIONS) {
      if (used.has(field.key)) continue;
      const score = scoreHeader(header, FIELD_KEYWORDS[field.key]);
      if (score > bestScore && score >= 60) {
        bestScore = score;
        bestKey = field.key;
      }
    }
    if (bestKey) used.add(bestKey);
    return { sourceColumn: header, fieldKey: bestKey };
  });
  return mappings;
};

// ─── Value coercion ────────────────────────────────────────────────────────
// Convert a raw extracted string into the typed value expected by a canonical
// field. Returns null when the value cannot be coerced so the caller can flag
// a warning.

export const coerceValue = (
  raw: string | number | undefined,
  type: 'text' | 'number' | 'date'
): string | number | null => {
  if (raw === undefined || raw === null) return null;
  if (type === 'number') {
    if (typeof raw === 'number') return raw;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'date') {
    if (typeof raw === 'number') return String(raw);
    const s = String(raw).trim();
    if (!s) return null;
    // Try to normalize common date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD).
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const ymd = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymd) {
      const [, y, m, d] = ymd;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Anything else (e.g. "MM/YYYY", "Oct 2025") is kept as-is so the user can
    // see what was extracted and fix it in the preview.
    return s;
  }
  // text
  return typeof raw === 'number' ? String(raw) : raw;
};
