// ─── PDF Extraction Engine ─────────────────────────────────────────────────────
// Core extraction logic for Smart Purchase Import.
// ROW-BY-ROW extraction: groups text items by Y-position into rows,
// then extracts values from each column within each row.
//
// Key behaviors:
//   - Detects header row from column mapping positions
//   - Processes only DATA rows (rows BELOW the header in visual terms)
//   - Skips summary, footer, GST, discount rows
//   - Stops at table end (hits summary row)
//   - Returns ONLY actual inventory items

import { ExtractedProduct, TableSelection, ColumnMapping } from './types';
import { ImportFieldKey } from '../../types';

// ─── PDF Text Item ────────────────────────────────────────────────────────────

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface PageTextData {
  page: number;
  items: PdfTextItem[];
  viewport: { width: number; height: number };
}

// ─── Row Detection Constants ─────────────────────────────────────────────────

const ROW_Y_TOLERANCE = 5;

// Keywords that indicate SUMMARY/FOOTER rows - END OF PRODUCT TABLE
const SUMMARY_KEYWORDS = [
  // Totals - these always come AFTER the product table
  'total', 'subtotal', 'grand total', 'net total',
  'invoice total', 'invoice value', 'taxable value',
  // Pricing - these come AFTER products
  'basic', 'net amount', 'gross amount',
  // Discounts - come AFTER products
  'discount',
  // Taxes - come AFTER products
  'cgst', 'sgst', 'igst', 'cess',
  // Invoice footer
  'round off', 'rounding',
  'amount in words', 'amount payable',
  'freight', 'transport', 'vehicle', 'delivery',
  'bank', 'account', 'ifsc',
  'declaration', 'terms', 'remarks',
  'signature', 'receiver', 'received',
  'for customer', 'for supplier',
  'e-way', 'eway bill',
];

// Keywords that indicate HEADER rows (column titles)
const HEADER_KEYWORDS = [
  'description', 'description of goods', 'item', 'product', 'particular',
  'qty', 'quantity', 'no.', 'no of', 's.no', 'sno', 'sr no',
  'hsn', 'hsn/sac', 'sac', 'hsn code',
  'unit', 'uom', 'bags', 'nos', 'pcs',
  'rate', 'price', 'unit price',
  'gst', 'gst %', 'tax',
  'amount', 'value',
  'per', '@', 'rs',
];

let _allPageText: PageTextData[] = [];

export const setPageTextData = (pageText: PageTextData[]): void => {
  _allPageText = pageText;
};

export const getPageTextData = (): PageTextData[] => _allPageText;

// ─── Check if row text is a summary/footer row ────────────────────────────────

const isSummaryRow = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.length < 2) return false;

  // Split into individual words
  const words = lower.split(/\s+/).filter(w => w.length > 0);

  for (const kw of SUMMARY_KEYWORDS) {
    const kwLower = kw.toLowerCase();
    // Check if keyword appears as a word in the text
    if (words.some(w => w === kwLower || w.startsWith(kwLower))) {
      return true;
    }
    // Check phrase match
    if (lower.includes(kwLower)) {
      // Verify it's not a partial match (e.g., "transportation" contains "transport")
      const idx = lower.indexOf(kwLower);
      const afterKw = lower.slice(idx + kwLower.length);
      if (afterKw.length === 0 || /\s|:|\.|\d/.test(afterKw[0])) {
        return true;
      }
    }
  }

  // Skip rows that are primarily numeric (like "48,720.44")
  const digits = (lower.match(/\d/g) || []).length;
  const letters = (lower.match(/[a-z]/gi) || []).length;
  if (digits > letters * 2 && digits > 4) return true;

  return false;
};

// ─── Check if row text is a header row ────────────────────────────────────────

const isHeaderRow = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;

  for (const kw of HEADER_KEYWORDS) {
    if (lower === kw) return true;
    if (lower.includes(kw)) return true;
  }
  return false;
};

// ─── Group text items into rows by Y-position ────────────────────────────────

interface TextRow {
  y: number;
  rowIndex: number; // Position in sorted array
  items: PdfTextItem[];
}

const groupItemsIntoRows = (items: PdfTextItem[]): TextRow[] => {
  const rowMap = new Map<number, PdfTextItem[]>();

  for (const item of items) {
    let foundRow = false;
    for (const [rowY] of rowMap) {
      if (Math.abs(rowY - item.y) < ROW_Y_TOLERANCE) {
        rowMap.get(rowY)!.push(item);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rowMap.set(item.y, [item]);
    }
  }

  // Sort rows by Y descending (PDF Y is bottom-up, so higher Y = top of page)
  // Result: rows ordered from TOP of page to BOTTOM of page
  const sortedRows = Array.from(rowMap.entries())
    .sort((a, b) => b[0] - a[0]) // Descending Y
    .map(([y, items], idx) => ({
      y,
      rowIndex: idx,
      items: items.sort((a, b) => a.x - b.x), // Items left to right
    }));

  console.log('[groupItemsIntoRows] Rows sorted TOP to BOTTOM (Y descending):');
  sortedRows.forEach((row, idx) => {
    const text = row.items.map(it => it.str).join(' ').substring(0, 70);
    const columns = row.items.map(it => it.str).join(' | ');
    console.log(`  Row[${idx}] Y=${row.y.toFixed(1)}: "${text}..."`);
  });

  return sortedRows;
};

// ─── Find header row index in sorted rows array ──────────────────────────────

const findHeaderRowIndex = (rows: TextRow[], columnMappings: ColumnMapping[]): number => {
  console.log('[findHeaderRowIndex] Searching for header row containing mapped headers:');
  columnMappings.forEach(m => console.log(`  - "${m.headerText}" (${m.fieldKey})`));

  // The header row contains the mapped column header text
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.items.map(it => it.str.toLowerCase()).join(' ');
    const rowTextOriginal = row.items.map(it => it.str).join(' ');

    let matchCount = 0;
    for (const mapping of columnMappings) {
      if (rowText.includes(mapping.headerText.toLowerCase())) {
        matchCount++;
      }
    }

    console.log(`[findHeaderRowIndex] Row[${i}] Y=${row.y.toFixed(1)}: "${rowTextOriginal.substring(0, 50)}..." matches=${matchCount}/${columnMappings.length}`);

    // Header must match at least half of mapped columns
    if (matchCount >= Math.ceil(columnMappings.length * 0.5)) {
      console.log(`[findHeaderRowIndex] *** HEADER DETECTED at row index ${i}, Y=${row.y} ***`);
      return i;
    }
  }

  // Fallback: find row with header keywords (but NOT summary keywords)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.items.map(it => it.str).join(' ');
    if (isHeaderRow(rowText) && !isSummaryRow(rowText)) {
      console.log(`[findHeaderRowIndex] *** HEADER (fallback) at row index ${i}, Y=${row.y} ***`);
      return i;
    }
  }

  console.log('[findHeaderRowIndex] ERROR: No header row found');
  return -1;
};

// ─── Extract value for a column within a row ────────────────────────────────

const extractColumnValueForRow = (row: TextRow, mapping: ColumnMapping): string => {
  const { xStart, xEnd } = mapping;

  // Find items in this row that fall within the column's X bounds
  const columnItems = row.items.filter(item => {
    const itemLeft = item.x;
    const itemRight = item.x + item.width;
    // Item overlaps with column bounds
    return itemLeft < xEnd && itemRight > xStart;
  });

  // Sort left-to-right and join
  columnItems.sort((a, b) => a.x - b.x);
  return columnItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
};

// ─── Main extraction: Process table row by row ──────────────────────────────

export const extractProductsFromSelection = (
  selection: TableSelection,
  mappings: ColumnMapping[]
): ExtractedProduct[] => {
  console.log('='.repeat(80));
  console.log('[extractProductsFromSelection] STARTING ROW-BY-ROW EXTRACTION');
  console.log('[extractProductsFromSelection] Selection:', selection);
  console.log('[extractProductsFromSelection] Column mappings:', mappings.map(m => `${m.fieldKey}: "${m.headerText}"`));
  console.log('='.repeat(80));

  if (mappings.length === 0) {
    console.error('[extractProductsFromSelection] ABORT: No column mappings');
    return [];
  }

  const pageData = _allPageText.find(p => p.page === selection.page);
  if (!pageData) {
    console.error('[extractProductsFromSelection] ABORT: No page data');
    return [];
  }

  // Step 1: Filter items to only those within table selection rectangle
  const itemsInTable = pageData.items.filter(item => {
    const inX = item.x >= selection.x && item.x <= selection.x + selection.width;
    const inY = item.y >= selection.y && item.y <= selection.y + selection.height;
    return inX && inY;
  });

  console.log(`[extractProductsFromSelection] Items in table rectangle: ${itemsInTable.length}`);

  if (itemsInTable.length === 0) {
    console.error('[extractProductsFromSelection] ABORT: No items in table area');
    return [];
  }

  // Step 2: Group items into rows (sorted top to bottom)
  const rows = groupItemsIntoRows(itemsInTable);
  console.log(`[extractProductsFromSelection] Total rows detected: ${rows.length}`);

  // Step 3: Find header row INDEX (not Y position)
  const headerRowIndex = findHeaderRowIndex(rows, mappings);
  if (headerRowIndex < 0) {
    console.error('[extractProductsFromSelection] ABORT: Header not found');
    return [];
  }

  const headerRow = rows[headerRowIndex];
  console.log(`[extractProductsFromSelection] HEADER ROW: index=${headerRowIndex}, Y=${headerRow.y}`);
  console.log(`[extractProductsFromSelection] Header row text: "${headerRow.items.map(it => it.str).join(' ')}"`);

  // Step 4: Process data rows (rows AFTER header in the sorted array)
  // In the sorted array (top to bottom), data rows come AFTER the header row
  const products: ExtractedProduct[] = [];
  let firstProductRowIndex = -1;
  let lastProductRowIndex = -1;
  let stopReason = '';

  console.log('-'.repeat(80));
  console.log('[extractProductsFromSelection] Processing data rows (scanning rows AFTER header)...');

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.items.map(it => it.str).join(' ');

    console.log(`[Row ${i}] Y=${row.y.toFixed(1)}: "${rowText.substring(0, 60)}..."`);

    // Check for summary row FIRST - this ends the product table
    if (isSummaryRow(rowText)) {
      stopReason = `Summary row detected: "${rowText.substring(0, 40)}..."`;
      console.log(`[Row ${i}] *** SUMMARY ROW DETECTED - STOPPING EXTRACTION ***`);
      console.log(`[extractProductsFromSelection] Stop reason: ${stopReason}`);
      break;
    }

    // Extract values from each mapped column
    const rowData: Partial<ExtractedProduct> = {};
    for (const mapping of mappings) {
      const value = extractColumnValueForRow(row, mapping);
      if (!value) continue;

      switch (mapping.fieldKey) {
        case 'productName': rowData.productName = value; break;
        case 'quantity': rowData.quantity = value; break;
        case 'hsnSac': rowData.hsnSac = value; break;
        case 'unit': rowData.unit = value; break;
        case 'purchasePrice': rowData.purchaseRate = value; break;
        case 'gstPercent': rowData.gstPercent = value; break;
        case 'amount': rowData.amount = value; break;
      }
    }

    // Log extracted columns
    console.log(`[Row ${i}] Extracted: Name="${rowData.productName}" Qty="${rowData.quantity}" Unit="${rowData.unit}" HSN="${rowData.hsnSac}" Rate="${rowData.purchaseRate}"`);

    // Validate: must have either quantity OR product name
    const qtyNum = rowData.quantity ? parseFloat(rowData.quantity.replace(/,/g, '')) : NaN;
    const hasQuantity = !isNaN(qtyNum) && qtyNum > 0;
    const hasProductName = (rowData.productName?.trim().length || 0) > 2;

    if (!hasQuantity && !hasProductName) {
      console.log(`[Row ${i}] Skipping: no valid quantity or product name`);
      continue;
    }

    // This is a valid product row
    if (firstProductRowIndex < 0) {
      firstProductRowIndex = i;
      console.log(`[extractProductsFromSelection] *** FIRST PRODUCT ROW at index ${i} ***`);
    }
    lastProductRowIndex = i;

    const product: ExtractedProduct = {
      id: `extracted-${Date.now()}-${products.length}`,
      productName: rowData.productName || '',
      quantity: rowData.quantity || '',
      hsnSac: rowData.hsnSac || '',
      unit: rowData.unit || '',
      purchaseRate: rowData.purchaseRate || '',
      gstPercent: rowData.gstPercent || '',
      amount: rowData.amount || '',
      yPosition: row.y,
    };

    products.push(product);
    console.log(`[Row ${i}] *** PRODUCT EXTRACTED #${products.length}: "${product.productName}" ***`);
  }

  console.log('='.repeat(80));
  console.log('[extractProductsFromSelection] EXTRACTION COMPLETE');
  console.log(`[extractProductsFromSelection] Header row index: ${headerRowIndex}`);
  console.log(`[extractProductsFromSelection] First product row index: ${firstProductRowIndex}`);
  console.log(`[extractProductsFromSelection] Last product row index: ${lastProductRowIndex}`);
  console.log(`[extractProductsFromSelection] Stop reason: ${stopReason || 'End of rows'}`);
  console.log(`[extractProductsFromSelection] Total products extracted: ${products.length}`);
  console.log('='.repeat(80));

  return products;
};

// ─── Text extraction from PDF ────────────────────────────────────────────────

export const extractTextFromPdf = async (pdfDoc: any): Promise<PageTextData[]> => {
  const pages: PageTextData[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    const items: PdfTextItem[] = (content.items as any[])
      .filter((it: any) => it.str && it.str.trim())
      .map((it: any) => {
        const tx = it.transform;
        const x = tx[4];
        const y = tx[5];
        const height = Math.abs(tx[3]) || 10;
        const width = it.width || (it.str.length * height * 0.5);
        return { str: it.str, x, y, width, height, page: i };
      });

    pages.push({ page: i, items, viewport: { width: viewport.width, height: viewport.height } });
  }

  return pages;
};

// ─── Legacy exports (deprecated) ─────────────────────────────────────────────

export interface ColumnValues {
  headerText: string;
  fieldKey: ImportFieldKey;
  values: string[];
  yPositions: number[];
  xStart: number;
  xEnd: number;
}

export const extractColumnValues = (mapping: ColumnMapping, selection: TableSelection): ColumnValues => {
  console.warn('[extractColumnValues] Deprecated');
  return { headerText: mapping.headerText, fieldKey: mapping.fieldKey, values: [], yPositions: [], xStart: mapping.xStart, xEnd: mapping.xEnd };
};

export const alignColumnsToRows = (columnsData: ColumnValues[]): ExtractedProduct[] => {
  console.warn('[alignColumnsToRows] Deprecated');
  return [];
};
