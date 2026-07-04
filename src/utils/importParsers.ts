import * as XLSX from 'xlsx';
import type {
  ImportFormat,
  ParseResult,
  ExtractedRow,
  ImportFieldKey,
  FieldMapping,
  DocumentMetadata,
  ConfidenceIssue,
  ImportParserPlugin,
} from '../types';
import { IMPORT_FIELD_DEFINITIONS } from '../types';

// ─── Parser Plugin Registry (Future-Ready Architecture) ───────────────────────
// Registry for parser plugins. New parsers (OCR, AI, barcode, etc.) can register
// themselves here and will be automatically used based on format and priority.

const parserPlugins: ImportParserPlugin[] = [];

export const registerParserPlugin = (plugin: ImportParserPlugin): void => {
  parserPlugins.push(plugin);
  parserPlugins.sort((a, b) => b.priority - a.priority);
};

export const getParserPlugins = (format: ImportFormat): ImportParserPlugin[] =>
  parserPlugins.filter(p => p.supportedFormats.includes(format));

// ─── Format detection ──────────────────────────────────────────────────────

export const detectFormat = (fileName: string): ImportFormat | null => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.pdf')) return 'pdf';
  return null;
};

// ─── Invoice Keywords for Table/Header Detection ─────────────────────────────

const INVOICE_KEYWORDS = [
  'invoice', 'bill', 'challan', 'purchase', 'order', 'delivery',
  'supplier', 'vendor', 'party', 'consignee', 'dispatch',
  'tax', 'gst', 'cgst', 'sgst', 'igst', 'vat', 'cess',
  'total', 'subtotal', 'net', 'gross', 'amount', 'value',
  'rupees', 'rs', '₹', 'inr', 'usd', 'eur',
  'dated', 'date', 'no.', 'number', 'ref', 'reference',
  'sno', 's.no', 'sl.no', 'slno', 'serial',
];

// ─── Header Normalization Engine ─────────────────────────────────────────────
// Converts various supplier header names into standard ERP field names.
// This ensures consistency regardless of how different suppliers name their columns.

const HEADER_NORMALIZATION_MAP: Record<string, string> = {
  // Product Name variants
  'product name': 'Product Name',
  'productname': 'Product Name',
  'product': 'Product Name',
  'item name': 'Product Name',
  'itemname': 'Product Name',
  'item': 'Product Name',
  'description': 'Product Name',
  'description of goods': 'Product Name',
  'goods': 'Product Name',
  'particular': 'Product Name',
  'particulars': 'Product Name',
  'product description': 'Product Name',
  'item description': 'Product Name',
  'article': 'Product Name',
  'material': 'Product Name',
  'commodity': 'Product Name',
  'medicine': 'Product Name',
  'drug': 'Product Name',
  'part name': 'Product Name',
  'part': 'Product Name',
  'name': 'Product Name',
  'stock item': 'Product Name',
  'stock name': 'Product Name',

  // Quantity variants
  'quantity': 'Quantity',
  'qty': 'Quantity',
  'qty.': 'Quantity',
  'nos': 'Quantity',
  'no.': 'Quantity',
  'pcs': 'Quantity',
  'pieces': 'Quantity',
  'no of units': 'Quantity',
  'no. of units': 'Quantity',
  'units': 'Quantity',
  'unit qty': 'Quantity',
  'pack qty': 'Quantity',
  'packing qty': 'Quantity',
  'no of packs': 'Quantity',
  'count': 'Quantity',
  'number': 'Quantity',

  // Purchase Price variants
  'purchase price': 'Purchase Price',
  'purchaseprice': 'Purchase Price',
  'purchase rate': 'Purchase Price',
  'purchaserate': 'Purchase Price',
  'rate': 'Purchase Price',
  'unit price': 'Purchase Price',
  'unitprice': 'Purchase Price',
  'price': 'Purchase Price',
  'price/unit': 'Purchase Price',
  'rate/unit': 'Purchase Price',
  'per unit': 'Purchase Price',
  'each': 'Purchase Price',
  'cost': 'Purchase Price',
  'cost price': 'Purchase Price',
  'costprice': 'Purchase Price',
  'buying price': 'Purchase Price',
  'unit rate': 'Purchase Price',
  'basic rate': 'Purchase Price',
  'base price': 'Purchase Price',
  'net rate': 'Purchase Price',
  'purchase cost': 'Purchase Price',
  'buying rate': 'Purchase Price',

  // GST variants
  'gst': 'GST',
  'gst%': 'GST',
  'gst %': 'GST',
  'gst rate': 'GST',
  'tax': 'GST',
  'tax%': 'GST',
  'tax %': 'GST',
  'tax rate': 'GST',
  'cgst': 'GST',
  'sgst': 'GST',
  'igst': 'GST',
  'vat': 'GST',
  'vat%': 'GST',
  'gst percent': 'GST',
  'tax percent': 'GST',

  // HSN/SAC variants
  'hsn/sac': 'HSN/SAC',
  'hsn sac': 'HSN/SAC',
  'hsn': 'HSN/SAC',
  'sac': 'HSN/SAC',
  'hsn code': 'HSN/SAC',
  'hsncode': 'HSN/SAC',
  'hsn no': 'HSN/SAC',
  'hsn no.': 'HSN/SAC',
  'sac code': 'HSN/SAC',
  'sac no': 'HSN/SAC',
  'classification code': 'HSN/SAC',
  'tariff': 'HSN/SAC',
  'item code': 'HSN/SAC',
  'product code': 'HSN/SAC',

  // MRP variants
  'mrp': 'MRP',
  'm.r.p': 'MRP',
  'm.r.p.': 'MRP',
  'maximum retail price': 'MRP',
  'maximum retail': 'MRP',
  'retail price': 'MRP',
  'selling price': 'MRP',
  'sellingprice': 'MRP',
  'sell': 'MRP',
  'mrp rs': 'MRP',
  'market price': 'MRP',
  'list price': 'MRP',
  'consumer price': 'MRP',
  'selling rate': 'MRP',
  'sale price': 'MRP',

  // Expiry variants
  'expiry': 'Expiry',
  'expiry date': 'Expiry',
  'expirydate': 'Expiry',
  'expiry dt': 'Expiry',
  'exp': 'Expiry',
  'exp date': 'Expiry',
  'exp. date': 'Expiry',
  'exp. dt': 'Expiry',
  'exp dt': 'Expiry',
  'expire': 'Expiry',
  'validity': 'Expiry',
  'valid upto': 'Expiry',
  'valid up to': 'Expiry',
  'shelf life': 'Expiry',
  'use by': 'Expiry',
  'best before': 'Expiry',
  'e.d.': 'Expiry',
  'ed': 'Expiry',

  // Batch variants
  'batch': 'Batch',
  'batch no': 'Batch',
  'batch no.': 'Batch',
  'batchno': 'Batch',
  'batch number': 'Batch',
  'batchnumber': 'Batch',
  'lot': 'Batch',
  'lot no': 'Batch',
  'lot no.': 'Batch',
  'lot number': 'Batch',
  'mfg batch': 'Batch',
  'b.no': 'Batch',
  'b.no.': 'Batch',
  'b no': 'Batch',
  'b/no': 'Batch',
  'bno': 'Batch',
  'b. no.': 'Batch',
  'mfg. batch no': 'Batch',

  // Unit variants
  'unit': 'Unit',
  'uom': 'Unit',
  'unit of measure': 'Unit',
  'unit of measurement': 'Unit',
  'measure': 'Unit',
  'unit type': 'Unit',
  'packing': 'Unit',
  'pack type': 'Unit',
  'pkg unit': 'Unit',
  'pack unit': 'Unit',
  'packing unit': 'Unit',
  'pkg': 'Unit',
  'pack': 'Unit',

  // Serial Number variants (product serial numbers like IMEI, equipment serial)
  'serial': 'Serial',
  'serial no': 'Serial',
  'serial no.': 'Serial',
  'serial number': 'Serial',
  'serialnumber': 'Serial',
  'imei': 'Serial',
  'imei no': 'Serial',
  'imei no.': 'Serial',
  'imei number': 'Serial',
  'serial#': 'Serial',
  'machine no': 'Serial',
  'machine serial': 'Serial',
  'equipment no': 'Serial',
  'asset no': 'Serial',
  'asset serial': 'Serial',

  // Discount variants
  'discount': 'Discount',
  'disc': 'Discount',
  'disc%': 'Discount',
  'discount%': 'Discount',
  'discount %': 'Discount',
  'disc %': 'Discount',
  'disc amt': 'Discount',
  'discount amount': 'Discount',
  'less': 'Discount',
  'rebate': 'Discount',
  'scheme': 'Discount',
  'offer': 'Discount',
  'special discount': 'Discount',
  'discount percent': 'Discount',
  'discount pct': 'Discount',
  'disc.': 'Discount',
  'discount amt': 'Discount',

  // Amount/Total variants
  'amount': 'Amount',
  'amt': 'Amount',
  'total': 'Amount',
  'line total': 'Amount',
  'net amount': 'Amount',
  'subtotal': 'Amount',
  'sub total': 'Amount',
  'net': 'Amount',
  'line amount': 'Amount',
  'item total': 'Amount',
  'value': 'Amount',
  'line value': 'Amount',
  'sum': 'Amount',
  'extended price': 'Amount',
  'item amount': 'Amount',
  'row total': 'Amount',
  'line item total': 'Amount',
  'item value': 'Amount',
  'total amount': 'Amount',
  'net amt': 'Amount',
  'total amt': 'Amount',
  'gross amount': 'Amount',
  'gross amt': 'Amount',

  // S.No / Row Number variants (keep as-is, these are row identifiers)
  'sno': 'S.No',
  's.no': 'S.No',
  's.no.': 'S.No',
  's no': 'S.No',
  'sl.no': 'S.No',
  'sl no': 'S.No',
  'sl.no.': 'S.No',
  'slno': 'S.No',
  'sr.no': 'S.No',
  'sr no': 'S.No',
  'sr no.': 'S.No',
  'row no': 'S.No',
  'row number': 'S.No',
  '#': 'S.No',
  'no': 'S.No',

  // Invoice Number variants
  'invoice no': 'Invoice No',
  'invoice no.': 'Invoice No',
  'invoice number': 'Invoice No',
  'invoiceno': 'Invoice No',
  'invoicenumber': 'Invoice No',
  'inv no': 'Invoice No',
  'inv no.': 'Invoice No',
  'inv.': 'Invoice No',
  'inv': 'Invoice No',
  'bill no': 'Invoice No',
  'bill no.': 'Invoice No',
  'bill number': 'Invoice No',
  'billno': 'Invoice No',
  'billnumber': 'Invoice No',
  'bill': 'Invoice No',
  'challan no': 'Invoice No',
  'challan number': 'Invoice No',
  'ref no': 'Invoice No',
  'reference no': 'Invoice No',
  'order no': 'Invoice No',
  'order number': 'Invoice No',
  'po no': 'Invoice No',
  'po number': 'Invoice No',
  'invoice #': 'Invoice No',
  'bill #': 'Invoice No',

  // Brand variants
  'brand': 'Brand',
  'brand name': 'Brand',
  'make': 'Brand',
  'manufacturer': 'Brand',
  'mfg': 'Brand',
  'mfg.': 'Brand',
  'company': 'Brand',

  // CGST specific (when split out)
  'cgst%': 'CGST%',
  'cgst %': 'CGST%',
  'cgst amt': 'CGST Amt',
  'cgst amount': 'CGST Amt',

  // SGST specific (when split out)
  'sgst%': 'SGST%',
  'sgst %': 'SGST%',
  'sgst amt': 'SGST Amt',
  'sgst amount': 'SGST Amt',

  // IGST specific (when split out)
  'igst%': 'IGST%',
  'igst %': 'IGST%',
  'igst amt': 'IGST Amt',
  'igst amount': 'IGST Amt',

  // Manufacturing Date variants
  'mfg date': 'Mfg Date',
  'mfg. date': 'Mfg Date',
  'mfgdate': 'Mfg Date',
  'mfg dt': 'Mfg Date',
  'mfg. dt': 'Mfg Date',
  'manufacturing date': 'Mfg Date',
  'mfd': 'Mfg Date',
  'mfd date': 'Mfg Date',
  'mfd on': 'Mfg Date',
  'dom': 'Mfg Date',
  'date of mfg': 'Mfg Date',
  'manufactured on': 'Mfg Date',
};

/**
 * Normalizes a header string to a standard ERP field name.
 * Handles various supplier-specific naming conventions.
 */
const normalizeHeaderToStandard = (header: string): string => {
  // Normalize the input: lowercase, remove special chars, trim
  const normalized = header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Remove special chars except spaces
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();

  // Try exact match first
  if (HEADER_NORMALIZATION_MAP[normalized]) {
    return HEADER_NORMALIZATION_MAP[normalized];
  }

  // Try removing spaces for compact forms (e.g., "productname", "batchno")
  const noSpaces = normalized.replace(/\s/g, '');
  if (HEADER_NORMALIZATION_MAP[noSpaces]) {
    return HEADER_NORMALIZATION_MAP[noSpaces];
  }

  // Try with spaces for compact input (e.g., "productname" -> "product name")
  // Try splitting camelCase or runon words
  for (const [key, value] of Object.entries(HEADER_NORMALIZATION_MAP)) {
    // Check if the normalized header contains or is contained by a known key
    if (key.includes(normalized) || normalized.includes(key)) {
      return value;
    }
  }

  // Try partial matching for compound headers like "GST Rate" or "Tax Amount"
  const parts = normalized.split(' ');
  for (const part of parts) {
    if (HEADER_NORMALIZATION_MAP[part]) {
      return HEADER_NORMALIZATION_MAP[part];
    }
  }

  // If no match found, return the original header (properly cased)
  // Capitalize first letter of each word
  return header
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Normalizes an array of headers to standard ERP field names.
 * Ensures unique names by appending numbers to duplicates.
 */
const normalizeHeaders = (headers: string[]): string[] => {
  const seen = new Map<string, number>();
  const normalized: string[] = [];

  for (const header of headers) {
    const standardName = normalizeHeaderToStandard(header);

    // Handle duplicates by appending a number
    const count = seen.get(standardName) || 0;
    seen.set(standardName, count + 1);

    if (count === 0) {
      normalized.push(standardName);
    } else {
      normalized.push(`${standardName} (${count + 1})`);
    }
  }

  return normalized;
};

// ─── Header Detection Engine ─────────────────────────────────────────────────
// Scores each row to find the most likely header row. Does NOT assume first row
// is the header. Searches all rows and returns the one with highest confidence.

const HEADER_KEYWORDS = {
  // High-confidence keywords (10 points) - these almost always mean header
  high: [
    'product name', 'product description', 'item name', 'item description',
    'description of goods', 'particulars', 'qty', 'quantity',
    'hsn/sac', 'hsn code', 'unit price', 'purchase price',
    'line total', 'net amount', 'batch no', 'batch number',
    'expiry date', 'exp date', 'serial no', 'serial number',
  ],
  // Medium-confidence keywords (6 points) - common in headers
  medium: [
    'product', 'item', 'description', 'name', 'particular', 'goods',
    'rate', 'price', 'amount', 'total', 'mrp', 'cost',
    'hsn', 'sac', 'gst', 'tax', 'cgst', 'sgst', 'igst',
    'batch', 'expiry', 'exp', 'unit', 'discount', 'disc',
    'sno', 's.no', 'slno', 'sl.no', 'nos', 'pcs',
  ],
  // Lower-confidence keywords (3 points) - could be header or data
  low: [
    'no', 'code', 'type', 'brand', 'model', 'make', 'size',
    'pack', 'packing', 'qty.', 'amt', 'val', 'value',
  ],
};

// Negative indicators - if row contains these, it's likely NOT a header
const DATA_INDICATORS = [
  // Long numbers (invoice numbers, phone numbers, amounts with many digits)
  /^[0-9]{4,}$/,
  // Currency amounts
  /^[₹$€][0-9,.]+$/,
  // Dates in various formats
  /^[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}$/,
  /^[0-9]{2,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2}$/,
  // Email patterns
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // GSTIN pattern
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i,
];

interface HeaderDetectionResult {
  headerRow: string[];
  headerRowIndex: number;
  confidence: number;
  dataRows: string[][];
}

/**
 * Scores a single row for how likely it is to be a header row.
 * Returns a score from 0-100 and indicators of why.
 */
const scoreRowForHeader = (cells: string[]): { score: number; matches: string[] } => {
  const matches: string[] = [];
  let score = 0;

  for (const cell of cells) {
    const normalizedCell = cell.toLowerCase().trim();
    if (!normalizedCell) continue;

    // Check for negative indicators (data patterns)
    let isDataPattern = false;
    for (const pattern of DATA_INDICATORS) {
      if (pattern.test(normalizedCell)) {
        isDataPattern = true;
        break;
      }
    }
    if (isDataPattern) continue;

    // Check high-confidence keywords
    for (const kw of HEADER_KEYWORDS.high) {
      if (normalizedCell === kw || normalizedCell.includes(kw)) {
        score += 10;
        matches.push(kw);
        break;
      }
    }

    // Check medium-confidence keywords
    for (const kw of HEADER_KEYWORDS.medium) {
      if (normalizedCell === kw || normalizedCell.includes(kw)) {
        score += 6;
        matches.push(kw);
        break;
      }
    }

    // Check low-confidence keywords (only exact match or starts with)
    for (const kw of HEADER_KEYWORDS.low) {
      if (normalizedCell === kw || normalizedCell.startsWith(kw + ' ') || normalizedCell.endsWith(' ' + kw)) {
        score += 3;
        matches.push(kw);
        break;
      }
    }
  }

  return { score, matches };
};

/**
 * Detects the header row from a 2D array of cells.
 * Searches all rows and returns the one with highest confidence.
 * Also handles cases where headers might span multiple rows.
 * Normalizes detected headers to standard ERP field names.
 */
const detectHeaderRow = (allRows: string[][]): HeaderDetectionResult => {
  if (allRows.length === 0) {
    return { headerRow: [], headerRowIndex: -1, confidence: 0, dataRows: [] };
  }

  // Score all rows
  const scoredRows = allRows.map((row, idx) => {
    const result = scoreRowForHeader(row);
    return { row, idx, score: result.score, matches: result.matches };
  });

  // Sort by score descending
  scoredRows.sort((a, b) => b.score - a.score);

  // Get the best candidate
  const best = scoredRows[0];

  // If best score is very low, we couldn't find a clear header
  if (best.score < 10) {
    // Generate generic column names
    const columnCount = allRows[0]?.length || 1;
    const headerRow = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
    return {
      headerRow,
      headerRowIndex: -1,
      confidence: 20,
      dataRows: allRows,
    };
  }

  // Calculate confidence based on score and position of header
  // Maximum confidence is 100
  let confidence = Math.min(100, 40 + best.score * 2);

  // Penalize if header is too far down (unusual)
  if (best.idx > 5) {
    confidence -= 10;
  }

  // Bonus if header is in first few rows (common case)
  if (best.idx <= 2) {
    confidence += 10;
  }

  // Bonus if we found multiple header keywords
  if (best.matches.length >= 3) {
    confidence += 5;
  }

  // Clamp confidence
  confidence = Math.max(0, Math.min(100, confidence));

  // Extract header row and normalize to standard ERP field names
  const rawHeaderRow = best.row.map(cell => cell.trim() || '');
  const headerRow = normalizeHeaders(rawHeaderRow);
  const dataRows = allRows.filter((_, idx) => idx !== best.idx);

  return {
    headerRow,
    headerRowIndex: best.idx,
    confidence,
    dataRows,
  };
};

const HEADER_PATTERNS: Record<ImportFieldKey, string[]> = {
  productName: [
    'product', 'item', 'description', 'name', 'particular', 'goods',
    'medicine', 'drug', 'article', 'material', 'commodity',
    'product name', 'item name', 'item description', 'description of goods',
    'particulars', 'details', 'part name', 'product description',
  ],
  description: [
    'description', 'detail', 'spec', 'remark', 'specification',
    'additional details', 'notes', 'comments',
  ],
  quantity: [
    'qty', 'quantity', 'nos', 'no', 'count', 'pieces', 'pcs', 'unit',
    'boxes', 'bottles', 'strips', 'packets', 'bags', 'qty.',
    'no. of units', 'number', 'units', 'pkg', 'packs',
  ],
  purchasePrice: [
    'rate', 'price', 'cost', 'purchase', 'mrp', 'amount', 'value',
    'price/unit', 'unit price', 'rate/unit', 'per unit', 'each',
    'purchase rate', 'cost price', 'buying price', 'unit rate',
    'basic rate', 'base price', 'net rate',
  ],
  gstPercent: [
    'gst', 'tax', 'cgst', 'sgst', 'igst', 'vat', 'tax%', 'gst%',
    'gst rate', 'tax rate', 'gst %', 'tax %', 'vat %',
  ],
  hsnSac: [
    'hsn', 'sac', 'code', 'hsn/sac', 'hsn code', 'sac code',
    'hsn no', 'hsn no.', 'hsn/sac code', 'sac no',
    'classification code', 'tariff',
  ],
  batch: [
    'batch', 'batch no', 'batch number', 'lot', 'lot no',
    'batch no.', 'lot number', 'mfg batch', 'b.no', 'b.no.',
  ],
  expiry: [
    'expiry', 'exp', 'expire', 'expiry date', 'validity',
    'exp date', 'exp. date', 'expiry dt', 'valid upto',
    'shelf life', 'use by', 'best before',
  ],
  mrp: [
    'mrp', 'maximum retail', 'retail price', 'selling price', 'sell',
    'max retail price', 'mrp rs', 'market price', 'list price',
    'consumer price', 'selling rate',
  ],
  amount: [
    'amount', 'total', 'line total', 'net amount', 'subtotal',
    'net', 'line amount', 'item total', 'value', 'line value',
    'sum', 'extended price',
  ],
  supplierInvoiceNumber: [
    'invoice', 'bill', 'bill no', 'invoice no', 'invoice number',
    'inv no', 'bill number', 'inv.', 'inv number', 'ref no',
    'reference no', 'challan no', 'order no',
  ],
  unit: [
    'unit', 'uom', 'unit of measure', 'measure', 'type',
    'unit type', 'packing', 'pack type', 'pkg unit',
  ],
  serialNumber: [
    'serial', 'serial no', 'serial number', 's.no', 'sno',
    'imei', 'imei no', 'imei number', 'serial no.',
    'machine no', 'equipment no', 'asset no',
  ],
  discount: [
    'discount', 'disc', 'disc%', 'discount%', 'discount %',
    'disc amt', 'discount amount', 'less', 'rebate',
    'scheme', 'offer', 'special discount',
  ],
};

// ─── Document Metadata Detection ─────────────────────────────────────────────

const Gstin_PATTERN = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/gi;
const Invoice_NUMBER_PATTERNS = [
  /(?:invoice|bill|inv|challan)[\s\-:.]*no\.?[\s\-:]*([A-Z0-9\/\-]+)/i,
  /(?:invoice|bill|inv|challan)[\s\-:.]*number[\s\-:]*([A-Z0-9\/\-]+)/i,
  /\b(?:inv|bill)[\s\-:.]*([A-Z0-9\/\-]+)/i,
];
const DATE_PATTERNS = [
  /(?:date|dated)[\s\-:.]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
  /(?:date|dated)[\s\-:.]*([0-9]{2,4}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2})/i,
  /([0-9]{1,2}[\/\-][A-Za-z]{3}[\/\-][0-9]{2,4})/,
  /([0-9]{1,2}[\-\/][0-9]{1,2}[\-\/][0-9]{2,4})/,
];
const CURRENCY_PATTERNS = [
  { pattern: /₹|rs\.?|inr|indian rupees/i, currency: 'INR' },
  { pattern: /\$|usd|dollars?/i, currency: 'USD' },
  { pattern: /€|eur|euros?/i, currency: 'EUR' },
];

const detectMetadata = (textLines: string[], pageCount: number): DocumentMetadata => {
  const fullText = textLines.join('\n');
  const metadata: DocumentMetadata = {
    currency: 'INR', // Default to INR for Indian context
    pageCount,
    isScanned: false,
    detectedKeywords: [],
  };

  // Detect GSTIN
  const gstinMatch = fullText.match(Gstin_PATTERN);
  if (gstinMatch) {
    metadata.supplierGstin = gstinMatch[0].toUpperCase();
  }

  // Detect invoice number
  for (const pattern of Invoice_NUMBER_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      metadata.invoiceNumber = match[1].trim();
      break;
    }
  }

  // Detect date
  for (const pattern of DATE_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      metadata.invoiceDate = match[1];
      break;
    }
  }

  // Detect supplier name (heuristic: first non-trivial line before GSTIN or near "from" or "supplier")
  const supplierPatterns = [
    /(?:from|supplier|vendor|party|consignor)[\s:]+([A-Za-z0-9\s&.,]+?)(?:\n|$)/i,
    /^([A-Z][A-Za-z\s&.,]+(?:PVT|LLP|LTD|CO|CORP|INDUSTRIES|ENTERPRISES|TRADERS|TRADNG|SALES|MEDICAL|PHARMA|HEALTHCARE)[A-Za-z\s&.,]*)/m,
  ];
  for (const pattern of supplierPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1].length > 3) {
      metadata.supplierName = match[1].trim().substring(0, 100);
      break;
    }
  }

  // Detect currency
  for (const { pattern, currency } of CURRENCY_PATTERNS) {
    if (pattern.test(fullText)) {
      metadata.currency = currency;
      break;
    }
  }

  // Detect keywords present
  const detectedKeywords = INVOICE_KEYWORDS.filter(kw =>
    fullText.toLowerCase().includes(kw.toLowerCase())
  );
  metadata.detectedKeywords = detectedKeywords.slice(0, 10);

  return metadata;
};

// ─── Scanned PDF Detection ─────────────────────────────────────────────────

const detectScannedPdf = async (
  pageTextItems: Array<{ str: string; transform: number[]; width: number }[]>
): Promise<boolean> => {
  // A scanned PDF typically has:
  // 1. Very few text items (just page numbers, watermarks)
  // 2. Or text items with very low word count relative to expected content
  const totalItems = pageTextItems.reduce((sum, items) => sum + items.length, 0);
  const totalWords = pageTextItems.reduce((sum, items) =>
    sum + items.reduce((w, item) => w + (item.str ? item.str.split(/\s+/).length : 0), 0), 0
  );

  // If we have very few text items or the average text density is very low
  // This indicates the PDF is likely a scanned image
  if (totalItems < 50 && totalWords < 100) {
    return true;
  }

  // Additional heuristic: check for image-like patterns
  // Scanned PDFs often have very short text fragments (single letters/words)
  const avgFragmentLength = pageTextItems.reduce((sum, items) =>
    sum + items.reduce((len, item) => len + (item.str?.length || 0), 0), 0
  ) / Math.max(totalItems, 1);

  // If average fragment is very short (like OCR artifacts from scanned doc)
  if (avgFragmentLength < 3 && totalItems < 200) {
    return true;
  }

  return false;
};

// ─── Improved Table Detection with Header Detection Engine ───────────────────

interface TextBlock {
  x: number;
  y: number;
  text: string;
  width: number;
}

const detectTableFromTextBlocks = (
  pageItems: Array<{ str: string; transform: number[]; width: number }>[]
): { headers: string[]; rows: ExtractedRow[]; confidence: number } => {
  const allBlocks: TextBlock[] = [];

  for (const items of pageItems) {
    for (const item of items) {
      if (!item.str?.trim()) continue;
      allBlocks.push({
        x: item.transform[4],
        y: Math.round(item.transform[5]),
        text: item.str.trim(),
        width: item.width || item.str.length * 3,
      });
    }
  }

  if (allBlocks.length < 10) {
    return { headers: [], rows: [], confidence: 20 };
  }

  // Group by Y coordinate (same line)
  const linesByY = new Map<number, TextBlock[]>();
  for (const block of allBlocks) {
    const y = Math.round(block.y / 2) * 2; // Round to nearest 2 for tolerance
    if (!linesByY.has(y)) linesByY.set(y, []);
    linesByY.get(y)!.push(block);
  }

  // Sort blocks within each line by X coordinate
  for (const [, blocks] of linesByY) {
    blocks.sort((a, b) => a.x - b.x);
  }

  // Sort lines by Y (top to bottom)
  const sortedYs = Array.from(linesByY.keys()).sort((a, b) => b - a);
  const sortedLines = sortedYs.map(y => linesByY.get(y)!);

  // Detect column boundaries by analyzing gaps between blocks
  const allEndPositions = allBlocks.map(b => b.x + b.width).sort((a, b) => a - b);

  // Find column boundaries (where there are significant gaps)
  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(Math.max(...allEndPositions) + 10);

  // Analyze line gaps to find columns
  for (const line of sortedLines) {
    for (let i = 0; i < line.length - 1; i++) {
      const gap = line[i + 1].x - (line[i].x + line[i].width);
      if (gap > 15) { // Gap threshold
        boundaries.add(line[i].x + line[i].width + gap / 2);
      }
    }
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const columnCount = sortedBoundaries.length - 1;

  if (columnCount < 2) {
    return { headers: [], rows: [], confidence: 25 };
  }

  // Assign each block to a column
  const assignColumn = (x: number): number => {
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      if (x >= sortedBoundaries[i] && x < sortedBoundaries[i + 1]) {
        return i;
      }
    }
    return columnCount - 1;
  };

  // Convert all lines to cell arrays for header detection
  const allRowsAsCells: string[][] = [];

  for (const line of sortedLines) {
    const rowData: Record<number, string[]> = {};

    for (const block of line) {
      const col = assignColumn(block.x);
      if (!rowData[col]) rowData[col] = [];
      rowData[col].push(block.text);
    }

    const cells: string[] = [];
    for (let c = 0; c < columnCount; c++) {
      const values = rowData[c] || [];
      cells.push(values.join(' '));
    }
    allRowsAsCells.push(cells);
  }

  // ─── Use Header Detection Engine ─────────────────────────────────────────
  // Find the actual header row by scoring all rows
  const headerResult = detectHeaderRow(allRowsAsCells);

  // Convert data rows to ExtractedRow format using detected headers
  const rows: ExtractedRow[] = [];
  const headers = headerResult.headerRow;

  for (const dataRow of headerResult.dataRows) {
    const row: ExtractedRow = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c] || `Column ${c + 1}`;
      row[header] = dataRow[c] || '';
    }
    rows.push(row);
  }

  // Confidence combines header detection confidence with table structure
  const tableConfidence = Math.min(95, 50 + rows.length * 2);
  const finalConfidence = Math.round((tableConfidence + headerResult.confidence) / 2);

  return { headers, rows, confidence: finalConfidence };
};

// ─── CSV / Excel parsing with Header Detection Engine ────────────────────────

/**
 * Parses a sheet and intelligently detects the header row.
 * Does NOT assume the first row is the header.
 * Uses the Header Detection Engine to find the actual header row.
 */
const sheetToRows = (sheet: XLSX.WorkSheet): { headers: string[]; rows: ExtractedRow[]; headerConfidence: number } => {
  // First, read the sheet with header: false to get all data as arrays
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', raw: true, header: 1 });
  if (rawData.length === 0) return { headers: [], rows: [], headerConfidence: 0 };

  // Convert to string arrays
  const allRowsAsCells: string[][] = rawData.map(row => {
    if (!Array.isArray(row)) return [];
    return row.map(cell => {
      if (cell === null || cell === undefined) return '';
      return typeof cell === 'number' ? String(cell) : String(cell).trim();
    });
  }).filter(row => row.some(cell => cell !== '')); // Remove empty rows

  if (allRowsAsCells.length === 0) return { headers: [], rows: [], headerConfidence: 0 };

  // Normalize column count across all rows
  const maxCols = Math.max(...allRowsAsCells.map(r => r.length));

  const normalizedRows = allRowsAsCells.map(row => {
    const normalized = [...row];
    while (normalized.length < maxCols) {
      normalized.push('');
    }
    return normalized;
  });

  // ─── Check if first row looks like a header (common case) ─────────────────
  const firstRow = normalizedRows[0] || [];
  const firstRowScore = scoreRowForHeader(firstRow);

  // If first row has high header score, use it as header directly
  // This is the most common case for well-formatted Excel/CSV files
  if (firstRowScore.score >= 15) {
    // Normalize headers to standard ERP field names
    const rawHeaders = firstRow.map(h => h || `Column`);
    const headers = normalizeHeaders(rawHeaders);
    const dataRows = normalizedRows.slice(1);

    const rows: ExtractedRow[] = dataRows.map(row => {
      const out: ExtractedRow = {};
      for (let i = 0; i < headers.length; i++) {
        out[headers[i]] = row[i] || '';
      }
      return out;
    });

    const headerConfidence = Math.min(100, 50 + firstRowScore.score * 2);
    return { headers, rows, headerConfidence };
  }

  // ─── First row doesn't look like header - use full detection engine ───────
  const headerResult = detectHeaderRow(normalizedRows);

  // Convert to ExtractedRow format
  const rows: ExtractedRow[] = headerResult.dataRows.map(row => {
    const out: ExtractedRow = {};
    for (let i = 0; i < headerResult.headerRow.length; i++) {
      const header = headerResult.headerRow[i] || `Column ${i + 1}`;
      out[header] = row[i] || '';
    }
    return out;
  });

  return { headers: headerResult.headerRow, rows, headerConfidence: headerResult.confidence };
};

const parseCsv = async (file: File): Promise<ParseResult> => {
  const text = await file.text();
  const workbook = XLSX.read(text, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return {
      format: 'csv',
      fileName: file.name,
      headers: [],
      rows: [],
      warnings: ['File appears to be empty.'],
      confidence: 30,
      confidenceIssues: [{ field: 'general', reason: 'Empty file', severity: 'critical' }],
    };
  }
  const { headers, rows, headerConfidence } = sheetToRows(sheet);
  const warnings: string[] = [];
  const confidenceIssues: ConfidenceIssue[] = [];

  if (rows.length === 0) warnings.push('No data rows found in the CSV.');

  // Check for required fields
  const hasProductCol = headers.some(h => /product|item|description|particular|name/i.test(h));
  const hasQtyCol = headers.some(h => /qty|quantity|nos|pcs/i.test(h));
  const hasPriceCol = headers.some(h => /rate|price|amount|mrp/i.test(h));

  if (!hasProductCol) confidenceIssues.push({ field: 'Product Name', reason: 'No product name column detected', severity: 'warning' });
  if (!hasQtyCol) confidenceIssues.push({ field: 'Quantity', reason: 'No quantity column detected', severity: 'warning' });
  if (!hasPriceCol) confidenceIssues.push({ field: 'Purchase Price', reason: 'No price column detected', severity: 'warning' });

  // Detect metadata from content
  const firstRows = rows.slice(0, 20);
  const sampleText = firstRows.map(r => Object.values(r).join(' ')).join('\n');
  const metadata = detectMetadata([sampleText], 1);

  // Confidence combines header detection with data presence
  const dataConfidence = rows.length > 0 ? 20 : 0;
  const finalConfidence = Math.min(95, headerConfidence + dataConfidence);

  return {
    format: 'csv',
    fileName: file.name,
    headers,
    rows,
    warnings,
    confidence: finalConfidence,
    confidenceIssues,
    metadata,
  };
};

const parseXlsx = async (file: File): Promise<ParseResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      format: 'xlsx',
      fileName: file.name,
      headers: [],
      rows: [],
      warnings: ['Workbook has no sheets.'],
      confidence: 30,
      confidenceIssues: [{ field: 'general', reason: 'No sheets in workbook', severity: 'critical' }],
    };
  }
  const sheet = workbook.Sheets[sheetName];
  const { headers, rows, headerConfidence } = sheetToRows(sheet);
  const warnings: string[] = [];
  const confidenceIssues: ConfidenceIssue[] = [];

  if (rows.length === 0) warnings.push('No data rows found in the first sheet.');

  // Check for required fields
  const hasProductCol = headers.some(h => /product|item|description|particular|name/i.test(h));
  const hasQtyCol = headers.some(h => /qty|quantity|nos|pcs/i.test(h));
  const hasPriceCol = headers.some(h => /rate|price|amount|mrp/i.test(h));

  if (!hasProductCol) confidenceIssues.push({ field: 'Product Name', reason: 'No product name column detected', severity: 'warning' });
  if (!hasQtyCol) confidenceIssues.push({ field: 'Quantity', reason: 'No quantity column detected', severity: 'warning' });
  if (!hasPriceCol) confidenceIssues.push({ field: 'Purchase Price', reason: 'No price column detected', severity: 'warning' });

  // Detect metadata from content
  const firstRows = rows.slice(0, 20);
  const sampleText = firstRows.map(r => Object.values(r).join(' ')).join('\n');
  const metadata = detectMetadata([sampleText], workbook.SheetNames.length);

  // Confidence combines header detection with data presence
  const dataConfidence = rows.length > 0 ? 20 : 0;
  const finalConfidence = Math.min(95, headerConfidence + dataConfidence);

  return {
    format: 'xlsx',
    fileName: file.name,
    headers,
    rows,
    warnings,
    confidence: finalConfidence,
    confidenceIssues,
    metadata,
  };
};

// ─── PDF parsing (Enhanced) ─────────────────────────────────────────────────

const parsePdf = async (file: File): Promise<ParseResult> => {
  try {
    // Dynamic import keeps pdfjs out of the main bundle for non-PDF imports.
    const pdfjs = await import('pdfjs-dist');
    // Worker is required for pdfjs to function in the browser.
    const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();

    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const warnings: string[] = [];
    const confidenceIssues: ConfidenceIssue[] = [];
    const allLines: string[] = [];
    const pageTextItems: Array<Array<{ str: string; transform: number[]; width: number }>> = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items = (content.items as Array<{ str: string; transform: number[]; width: number }>)
        .filter(item => item.str?.trim());

      pageTextItems.push(items);

      // Reconstruct lines using item transform Y coordinate.
      const lineMap = new Map<number, { x: number; text: string }[]>();
      for (const item of items) {
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

    // Check if this is a scanned PDF
    const isScanned = await detectScannedPdf(pageTextItems);

    if (isScanned) {
      return {
        format: 'pdf',
        fileName: file.name,
        headers: [],
        rows: [],
        warnings: [
          'Scanned PDFs are not supported yet. Please upload a text-based PDF or Excel file.',
          'OCR support will be added in a future update.',
        ],
        confidence: 0,
        confidenceIssues: [{ field: 'general', reason: 'Scanned PDF detected - OCR not yet supported', severity: 'critical' }],
        metadata: {
          currency: 'INR',
          pageCount: doc.numPages,
          isScanned: true,
          detectedKeywords: [],
        },
        rawTextLines: allLines,
      };
    }

    // Use advanced table detection
    const { headers, rows, confidence } = detectTableFromTextBlocks(pageTextItems);

    // Detect document metadata
    const metadata = detectMetadata(allLines, doc.numPages);

    if (rows.length === 0) {
      warnings.push('Could not detect a tabular layout in the PDF. You can still map columns manually.');
      confidenceIssues.push({
        field: 'general',
        reason: 'No table structure detected - manual mapping required',
        severity: 'warning'
      });
    }

    // Check for missing key fields
    if (headers.length > 0) {
      const headerText = headers.join(' ').toLowerCase();
      if (!headerText.includes('product') && !headerText.includes('item') && !headerText.includes('description')) {
        confidenceIssues.push({ field: 'Product Name', reason: 'Product name column not clearly identified', severity: 'warning' });
      }
      if (!headerText.includes('qty') && !headerText.includes('quantity')) {
        confidenceIssues.push({ field: 'Quantity', reason: 'Quantity column not clearly identified', severity: 'warning' });
      }
    }

    // Analyze metadata gaps
    if (!metadata.invoiceNumber) {
      confidenceIssues.push({ field: 'Invoice Number', reason: 'Invoice number not detected', severity: 'info' });
    }
    if (!metadata.invoiceDate) {
      confidenceIssues.push({ field: 'Invoice Date', reason: 'Invoice date not detected', severity: 'info' });
    }
    if (!metadata.supplierGstin) {
      confidenceIssues.push({ field: 'Supplier GSTIN', reason: 'Supplier GSTIN not detected', severity: 'info' });
    }

    return {
      format: 'pdf',
      fileName: file.name,
      headers,
      rows,
      warnings,
      confidence,
      confidenceIssues,
      metadata,
      rawTextLines: allLines,
    };
  } catch (err) {
    return {
      format: 'pdf',
      fileName: file.name,
      headers: [],
      rows: [],
      warnings: [`Failed to read PDF: ${err instanceof Error ? err.message : 'unknown error'}`],
      confidence: 10,
      confidenceIssues: [{ field: 'general', reason: err instanceof Error ? err.message : 'PDF parsing failed', severity: 'critical' }],
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
      confidenceIssues: [{ field: 'general', reason: 'Unsupported file format', severity: 'critical' }],
    };
  }

  // Check for registered plugins first
  const plugins = getParserPlugins(format);
  for (const plugin of plugins) {
    try {
      const result = await plugin.parse(file);
      if (result.rows.length > 0 || result.confidence > 50) {
        return result;
      }
    } catch {
      // Plugin failed, continue to default parser
    }
  }

  // Use default parsers
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
    else {
      // Fuzzy match for partial matches
      const parts = k.split(' ');
      for (const part of parts) {
        if (part.length >= 3 && h.includes(part)) {
          best = Math.max(best, 50);
        }
      }
    }
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
      const keywords = HEADER_PATTERNS[field.key] || [];
      const score = scoreHeader(header, keywords);
      if (score > bestScore && score >= 50) {
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
    // Handle MM/YYYY format (common for expiry dates)
    const my = s.match(/^(\d{1,2})[/-](\d{2,4})$/);
    if (my) {
      const [, m, y] = my;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-01`;
    }
    // Anything else is kept as-is so the user can see what was extracted.
    return s;
  }
  // text
  return typeof raw === 'number' ? String(raw) : raw;
};

// ─── Confidence Score Helper ───────────────────────────────────────────────

export const getConfidenceLevel = (score: number): 'high' | 'medium' | 'low' | 'critical' => {
  if (score >= 90) return 'high';
  if (score >= 70) return 'medium';
  if (score >= 50) return 'low';
  return 'critical';
};

export const getConfidenceColor = (score: number): string => {
  if (score >= 90) return 'text-emerald-600 bg-emerald-100 border-emerald-200';
  if (score >= 70) return 'text-blue-600 bg-blue-100 border-blue-200';
  if (score >= 50) return 'text-amber-600 bg-amber-100 border-amber-200';
  return 'text-red-600 bg-red-100 border-red-200';
};

export const getConfidenceIcon = (score: number): 'check' | 'alert' | 'warning' | 'error' => {
  if (score >= 90) return 'check';
  if (score >= 70) return 'alert';
  if (score >= 50) return 'warning';
  return 'error';
};
