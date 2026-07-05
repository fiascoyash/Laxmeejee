// ─── PDF Column Detection Engine ─────────────────────────────────────────────
// Given a clicked header text item in a PDF, this engine detects the full
// column beneath it by analyzing the x-positions and y-positions of all text
// items on the same page. It groups items into rows and extracts the values
// that fall within the column's horizontal extent.
//
// Key behaviors:
//   - Detects the product table boundary and stops extraction at footer rows
//   - Filters out summary/tax/footer rows that aren't real products
//   - Discards rows with empty product names
//   - Aligns values across columns by row y-position (same horizontal row)
//
// Architecture is designed so OCR/AI can be plugged in later by swapping the
// text-item source — the column detection logic itself is text-source-agnostic.

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface DetectedColumn {
  // The header text item the user clicked
  headerItem: PdfTextItem;
  // Detected column bounds in PDF coordinate space
  xStart: number;
  xEnd: number;
  // Page where the header was found
  page: number;
  // Extracted values, one per row beneath the header
  values: string[];
  // Y positions of each row (for cross-column row alignment)
  rowYPositions: number[];
}

export interface PageTextData {
  page: number;
  items: PdfTextItem[];
}

// ─── Footer / Summary keyword detection ───────────────────────────────────────
// When any of these keywords appear in a row, that row and everything below
// it is treated as footer/summary — NOT product data. Extraction stops.

const FOOTER_KEYWORDS = [
  'taxable value',
  'invoice value',
  'invoice total',
  'grand total',
  'net amount',
  'round off',
  'round-off',
  'sgst',
  'cgst',
  'igst',
  'utgst',
  'amount in words',
  'amount payable',
  'total amount',
  'total payable',
  'net payable',
  'transport',
  'vehicle',
  'freight',
  'bank details',
  'bank name',
  'account no',
  'account number',
  'ifsc',
  'branch',
  'declaration',
  'terms & conditions',
  'terms and conditions',
  'e-way bill',
  'eway bill',
  'remarks',
  'for customer',
  'for supplier',
  'received by',
  'signature',
  'subject to',
  'this is a computer',
  'computer generated',
  'total qty',
  'total quantity',
  'sub total',
  'subtotal',
  'discount total',
  'discount summary',
  'tax amount',
  'total tax',
  'cgst amount',
  'sgst amount',
  'igst amount',
  'cess',
  'total cgst',
  'total sgst',
  'total igst',
];

// Check if a text line matches any footer keyword (case-insensitive, whole-word)
const isFooterLine = (text: string): boolean => {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  for (const kw of FOOTER_KEYWORDS) {
    // Match as a whole word/phrase — the line starts with or contains the keyword
    // as a distinct phrase, not as a substring of a product name.
    if (lower === kw) return true;
    if (lower.startsWith(kw + ' ') || lower.startsWith(kw + ':') || lower.startsWith(kw + '.')) return true;
    if (lower.includes(' ' + kw + ' ') || lower.includes(' ' + kw + ':') || lower.includes(' ' + kw + '.')) return true;
    // Also catch "Total: 1234" style where the keyword is followed by a number
    if (lower.startsWith(kw) && /\d/.test(lower.slice(kw.length))) return true;
  }
  return false;
};

// ─── Junk row detection ──────────────────────────────────────────────────────
// Only filters clearly-empty or punctuation-only rows. Pure numbers are NOT
// junk — they are legitimate values for Quantity, HSN, Rate, GST, Amount
// columns. The previous version incorrectly dropped "142", "25232930",
// "6862.03" etc. as junk, which destroyed the extracted data.

const isJunkValue = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Pure currency symbol or punctuation only (no digits, no letters)
  if (/^[₹$€.,\-]+$/.test(trimmed)) return true;
  // Just "Rs" or "Rs." alone
  if (/^rs\.?$/i.test(trimmed)) return true;
  return false;
};

// ─── Column width estimation ─────────────────────────────────────────────────
// Given a header text item, estimate the column's horizontal extent. We look
// at the gaps between this header and its neighbors on the same line to find
// the left and right boundaries.

const estimateColumnBounds = (
  headerItem: PdfTextItem,
  allItemsOnPage: PdfTextItem[]
): { xStart: number; xEnd: number } => {
  // Find items on the same line (same y, within tolerance) as the header
  const headerY = headerItem.y;
  const sameLineItems = allItemsOnPage
    .filter(it => it.page === headerItem.page && Math.abs(it.y - headerY) < 3)
    .sort((a, b) => a.x - b.x);

  // Find the header's position in the sorted line (with tolerance for x)
  const X_TOLERANCE = 2;
  let headerIdx = sameLineItems.findIndex(
    it => Math.abs(it.x - headerItem.x) < X_TOLERANCE && it.str === headerItem.str
  );

  // If not found with tolerance, try just matching the text (header might have slightly different x)
  if (headerIdx < 0) {
    headerIdx = sameLineItems.findIndex(it => it.str.trim() === headerItem.str.trim());
  }

  // Default bounds: generous padding around the header text
  const generousPadding = 20;
  let xStart = headerItem.x - generousPadding;
  let xEnd = headerItem.x + headerItem.width + generousPadding;

  // Look at the gap to the left neighbor to set xStart
  if (headerIdx > 0) {
    const leftNeighbor = sameLineItems[headerIdx - 1];
    const gap = headerItem.x - (leftNeighbor.x + leftNeighbor.width);
    if (gap > 0) {
      // Midpoint between left neighbor and this column
      xStart = Math.max(xStart, leftNeighbor.x + leftNeighbor.width + gap * 0.5);
    }
  }

  // Look at the gap to the right neighbor to set xEnd
  if (headerIdx >= 0 && headerIdx < sameLineItems.length - 1) {
    const rightNeighbor = sameLineItems[headerIdx + 1];
    const gap = rightNeighbor.x - (headerItem.x + headerItem.width);
    if (gap > 0) {
      // Midpoint between this column and right neighbor
      xEnd = Math.min(xEnd, headerItem.x + headerItem.width + gap * 0.5);
    }
  }

  // If last item on the line or headerIdx not found, extend right bound generously
  if (headerIdx < 0 || headerIdx >= sameLineItems.length - 1) {
    xEnd = Math.max(xEnd, headerItem.x + headerItem.width + 80);
  }

  // Ensure minimum width for data columns (numbers need space)
  const minWidth = 50;
  if (xEnd - xStart < minWidth) {
    // Expand symmetrically
    const center = (xStart + xEnd) / 2;
    xStart = center - minWidth / 2;
    xEnd = center + minWidth / 2;
  }

  console.log('[estimateColumnBounds] Header:', headerItem.str,
    '| headerIdx:', headerIdx,
    '| xStart:', xStart.toFixed(1),
    '| xEnd:', xEnd.toFixed(1),
    '| width:', (xEnd - xStart).toFixed(1));

  return { xStart, xEnd };
};

// ─── Row grouping beneath a header ───────────────────────────────────────────
// Group all text items below the header (within the column's x-extent) into
// rows by y-position. Returns rows sorted top-to-bottom, each with its y-pos
// and joined text. Does NOT filter footers here — that's done by the caller
// using the table boundary detection.

const ROW_Y_TOLERANCE = 5; // pdfjs points — slightly generous for row alignment

interface RawRow {
  y: number;
  items: PdfTextItem[];
  text: string;
}

const groupItemsIntoRows = (items: PdfTextItem[]): RawRow[] => {
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

  // Sort rows top-to-bottom (highest y first in pdfjs = top of page)
  const sortedRowYs = Array.from(rowMap.keys()).sort((a, b) => b - a);

  return sortedRowYs.map(y => {
    const rowItems = rowMap.get(y)!.sort((a, b) => a.x - b.x);
    const text = rowItems.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
    return { y, items: rowItems, text };
  });
};

// ─── Table boundary detection ─────────────────────────────────────────────────
// Given all rows on a page (sorted top-to-bottom), find the y-position where
// the product table ends. The table ends at the first row that matches a
// footer keyword. Returns the y-position of the last product row, or null
// if no footer is found (extraction continues to the bottom of the page
// but rows are still filtered individually).

const detectTableBottomY = (allRowsOnPage: RawRow[]): number | null => {
  for (const row of allRowsOnPage) {
    if (isFooterLine(row.text)) {
      // This row is a footer — the table ends above this row
      return row.y + ROW_Y_TOLERANCE; // y threshold; rows with y < this are products
    }
  }
  return null; // no footer found
};

// ─── Main column detection ───────────────────────────────────────────────────
// Detect a column from a clicked header. Extracts all rows beneath the header
// within the column's x-extent, stopping at the table boundary (footer rows).

export const detectColumnFromHeader = (
  headerItem: PdfTextItem,
  allPageText: PageTextData[]
): DetectedColumn => {
  console.log('[detectColumnFromHeader] START Header:', headerItem.str, '| page:', headerItem.page);

  const pageData = allPageText.find(p => p.page === headerItem.page);
  if (!pageData) {
    console.warn('[detectColumnFromHeader] No page data found');
    return {
      headerItem,
      xStart: headerItem.x,
      xEnd: headerItem.x + headerItem.width,
      page: headerItem.page,
      values: [],
      rowYPositions: [],
    };
  }

  let { xStart, xEnd } = estimateColumnBounds(headerItem, pageData.items);

  // Find all items below the header on the same page, within the column's
  // x-extent. In pdfjs, lower y values are further down the page.
  // Use a more permissive overlap check: value is in column if it STARTS within
  // the column bounds OR if it ENDS within the column bounds OR overlaps.
  // This handles left-aligned, right-aligned, and center-aligned values.
  let itemsBelow = pageData.items
    .filter(it => it.y < headerItem.y - 2) // strictly below the header
    .filter(it => {
      const itemEnd = it.x + it.width;
      const overlapsLeft = it.x >= xStart && it.x <= xEnd;  // value starts in column
      const overlapsRight = itemEnd >= xStart && itemEnd <= xEnd;  // value ends in column
      const overlapsMiddle = it.x < xStart && itemEnd > xEnd;  // value spans column
      return overlapsLeft || overlapsRight || overlapsMiddle;
    });

  // If very few items found, expand bounds progressively
  // Many invoice formats have misaligned values
  if (itemsBelow.length < 3) {
    console.log('[detectColumnFromHeader] Only', itemsBelow.length, 'items found, expanding bounds');

    // First expansion: generous padding
    const expandBy = 30;
    xStart = Math.max(0, xStart - expandBy);
    xEnd = xEnd + expandBy;

    itemsBelow = pageData.items
      .filter(it => it.y < headerItem.y - 2)
      .filter(it => it.x + it.width >= xStart && it.x <= xEnd);

    // If still too few, try even more aggressive expansion
    if (itemsBelow.length < 3) {
      xStart = Math.max(0, xStart - 50);
      xEnd = xEnd + 50;

      itemsBelow = pageData.items
        .filter(it => it.y < headerItem.y - 2)
        .filter(it => it.x + it.width >= xStart && it.x <= xEnd);

      console.log('[detectColumnFromHeader] After aggressive expansion:', itemsBelow.length, 'items');
    }
  }

  console.log('[detectColumnFromHeader] Found', itemsBelow.length, 'items below header within bounds');

  // Group into rows
  const rawRows = groupItemsIntoRows(itemsBelow);
  console.log('[detectColumnFromHeader] Grouped into', rawRows.length, 'raw rows');

  // Detect the table boundary — the first footer row ends the table
  const tableBottomY = detectTableBottomY(rawRows);

  // Filter rows: stop at the table boundary, remove junk values
  const values: string[] = [];
  const rowYPositions: number[] = [];

  for (const row of rawRows) {
    // If we've detected a table bottom, stop extracting below it
    if (tableBottomY !== null && row.y < tableBottomY - ROW_Y_TOLERANCE) {
      continue;
    }
    // Skip junk rows (pure numbers, punctuation, etc.)
    if (isJunkValue(row.text)) continue;
    // Skip rows that are themselves footer lines (defensive — tableBottomY
    // should already have stopped us, but a footer row might sneak through)
    if (isFooterLine(row.text)) continue;

    values.push(row.text);
    rowYPositions.push(row.y);
  }

  console.log('[detectColumnFromHeader] Final values count:', values.length, '| first few:', values.slice(0, 3));
  console.log('[detectColumnFromHeader] yPositions:', rowYPositions);

  return {
    headerItem,
    xStart,
    xEnd,
    page: headerItem.page,
    values,
    rowYPositions,
  };
};

// ─── Cross-column row alignment with multi-line product name merging ─────────
// Many supplier invoices (e.g. ACC Cement) split a single product name across
// multiple text lines:
//
//   ACC Cement Suraksha PP      142   25232930   BAGS   6862.03   18%   52966
//   Bag-50Kg TRDG
//
// The data columns (Qty, HSN, Rate, etc.) each have ONE value per product at
// a single y-position. But the product NAME column spans multiple y-positions.
//
// Strategy:
//   1. Anchor the row grid on a DATA column (Quantity or Amount) — each value
//      in that column = one product row.
//   2. For each anchor row, find matching values in other data columns at the
//      same y-position (within tolerance).
//   3. For the product name column, collect ALL text items between the previous
//      anchor y and the next anchor y, and merge them into a single name.
//   4. Discard rows with no product name and no data values.
//   5. Filter footer/summary rows.

const isProductNameColumn = (col: DetectedColumn): boolean => {
  const h = col.headerItem.str.trim().toLowerCase();
  return h.includes('description') ||
         h.includes('product') ||
         h.includes('item') ||
         h.includes('particular') ||
         h.includes('goods') ||
         h.includes('name');
};

export const alignColumnRows = (
  columns: DetectedColumn[]
): { rowValues: Record<string, string>; yPosition: number }[] => {
  console.log('[alignColumnRows] START with', columns.length, 'columns');
  if (columns.length === 0) return [];

  // Log what each column detected
  for (const col of columns) {
    console.log('[alignColumnRows] Column:', col.headerItem.str.trim(),
      '| values:', col.values.length,
      '| yPositions:', col.rowYPositions.length,
      '| first 3 values:', col.values.slice(0, 3));
  }

  const productNameCol = columns.find(isProductNameColumn) || null;
  const dataColumns = columns.filter(c => c !== productNameCol);

  console.log('[alignColumnRows] Product name col:', productNameCol?.headerItem.str.trim() || 'none');
  console.log('[alignColumnRows] Data columns:', dataColumns.map(c => c.headerItem.str.trim()));

  // Choose the anchor: prefer Quantity, then Amount, then the first data column.
  // The anchor must have at least one value to define row positions.
  let anchorCol: DetectedColumn | null =
    dataColumns.find(c => c.headerItem.str.trim().toLowerCase().includes('qty')) ||
    dataColumns.find(c => c.headerItem.str.trim().toLowerCase().includes('quantity')) ||
    dataColumns.find(c => c.headerItem.str.trim().toLowerCase().includes('amount')) ||
    dataColumns[0] ||
    null;

  // If no data columns at all, fall back to product name as anchor (single-column case)
  if (!anchorCol && productNameCol) {
    anchorCol = productNameCol;
  }
  if (!anchorCol) {
    console.warn('[alignColumnRows] No anchor column found');
    return [];
  }

  console.log('[alignColumnRows] Anchor column:', anchorCol.headerItem.str.trim(),
    '| yPositions:', anchorCol.rowYPositions.length);

  const anchorYs = anchorCol.rowYPositions;
  if (anchorYs.length === 0) {
    console.warn('[alignColumnRows] Anchor has no yPositions');
    return [];
  }

  // Sort anchor y-positions top-to-bottom (descending in pdfjs coords)
  const sortedAnchorYs = [...anchorYs].sort((a, b) => b - a);
  console.log('[alignColumnRows] Sorted anchor Ys:', sortedAnchorYs);

  // For multi-line name merging, we need the y-boundaries of each product row.
  // A product row spans from the y just below the previous anchor, down to
  // the y just above the next anchor. In pdfjs coords (y increases upward):
  //   row i spans from (sortedAnchorYs[i] + small) down to (sortedAnchorYs[i+1] - small)
  // For the last row, it spans down to the table bottom (or a generous gap).

  const rows: { rowValues: Record<string, string>; yPosition: number }[] = [];

  for (let rowIdx = 0; rowIdx < sortedAnchorYs.length; rowIdx++) {
    const anchorY = sortedAnchorYs[rowIdx];
    const rowValues: Record<string, string> = {};

    console.log(`[alignColumnRows] Processing row ${rowIdx} at y=${anchorY.toFixed(1)}`);

    // ── Pull values from each data column at this y-position ──────────────
    for (const col of dataColumns) {
      // Find corresponding value in this column at same y
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < col.rowYPositions.length; i++) {
        const dist = Math.abs(col.rowYPositions[i] - anchorY);
        if (dist < bestDist && dist < ROW_Y_TOLERANCE) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const header = col.headerItem.str.trim();
        const value = col.values[bestIdx];
        rowValues[header] = value;
        console.log(`[alignColumnRows]   ${header}: "${value}" (dist=${bestDist.toFixed(1)})`);
      } else {
        console.log(`[alignColumnRows]   ${col.headerItem.str.trim()}: NO MATCH (closest dist was > ${ROW_Y_TOLERANCE})`);
      }
    }

    // ── Merge multi-line product name ─────────────────────────────────────
    // Collect all product-name text items whose y falls between this anchor's
    // y and the next anchor's y (exclusive). In pdfjs coords, the next row is
    // BELOW (lower y). So name items for this row have y in:
    //   (nextAnchorY + tol, anchorY]   — i.e. between the two data rows
    let productNameValue = '';
    if (productNameCol) {
      const nextAnchorY = rowIdx < sortedAnchorYs.length - 1 ? sortedAnchorYs[rowIdx + 1] : null;
      // Name items at the same y as the anchor (the first line of the name)
      // plus any items below the anchor down to (but not including) the next row.
      const nameYs = productNameCol.rowYPositions;
      const fragmentsWithY: { y: number; text: string }[] = [];

      for (let i = 0; i < nameYs.length; i++) {
        const ny = nameYs[i];
        // Must be at or below the anchor's first line (within tolerance) and
        // above the next anchor row
        if (ny <= anchorY + ROW_Y_TOLERANCE) {
          if (nextAnchorY === null || ny > nextAnchorY + ROW_Y_TOLERANCE) {
            fragmentsWithY.push({ y: ny, text: productNameCol.values[i] });
          }
        }
      }
      // Sort collected name fragments by their y descending (top-to-bottom)
      // so the name reads in the correct order
      fragmentsWithY.sort((a, b) => b.y - a.y);
      productNameValue = fragmentsWithY.map(f => f.text).join(' ').replace(/\s+/g, ' ').trim();
      if (productNameValue) {
        rowValues[productNameCol.headerItem.str.trim()] = productNameValue;
        console.log(`[alignColumnRows]   Product Name: "${productNameValue}"`);
      }
    }

    // ── Discard rows with no product name AND no data values ──────────────
    const productNameHeader = productNameCol?.headerItem.str.trim() ?? '';
    const hasData = Object.keys(rowValues).some(k => k !== productNameHeader && rowValues[k] && rowValues[k].trim());
    const hasProductName = productNameValue.trim().length > 0;

    if (!productNameValue.trim() && !hasData) {
      console.log(`[alignColumnRows]   SKIPPING row ${rowIdx} - no product name and no data`);
      continue;
    }

    // ── Filter footer/summary rows ─────────────────────────────────────────
    if (productNameValue && isFooterLine(productNameValue)) {
      console.log(`[alignColumnRows]   SKIPPING row ${rowIdx} - footer line`);
      continue;
    }

    console.log(`[alignColumnRows]   KEEPING row ${rowIdx}:`, rowValues);
    rows.push({ rowValues, yPosition: anchorY });
  }

  console.log('[alignColumnRows] FINAL rows:', rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    console.log(`[alignColumnRows] ===== ROW ${i} =====`);
    console.log('[alignColumnRows] Detected row bounds: y=', r.yPosition.toFixed(1));
    console.log('[alignColumnRows] Row Y coordinate:', r.yPosition);
    console.log('[alignColumnRows] Product cell:', r.rowValues[productNameCol?.headerItem.str.trim() || ''] || 'N/A');
    console.log('[alignColumnRows] Qty cell:', Object.entries(r.rowValues).find(([k]) => k.toLowerCase().includes('qty'))?.[1] || 'N/A');
    console.log('[alignColumnRows] HSN cell:', Object.entries(r.rowValues).find(([k]) => k.toLowerCase().includes('hsn'))?.[1] || 'N/A');
    console.log('[alignColumnRows] Rate cell:', Object.entries(r.rowValues).find(([k]) => k.toLowerCase().includes('rate') || k.toLowerCase().includes('price'))?.[1] || 'N/A');
    console.log('[alignColumnRows] GST cell:', Object.entries(r.rowValues).find(([k]) => k.toLowerCase().includes('gst'))?.[1] || 'N/A');
    console.log('[alignColumnRows] Amount cell:', Object.entries(r.rowValues).find(([k]) => k.toLowerCase().includes('amount'))?.[1] || 'N/A');
    console.log('[alignColumnRows] Final Product Object:', r.rowValues);
  }
  return rows;
};

// ─── Auto-apply saved layout ──────────────────────────────────────────────────
// Given a saved SupplierPdfLayout (with column coordinates from a previous
// import) and the current PDF's text items, re-detect the columns by finding
// header text items near the saved coordinates. Returns the detected columns
// so the UI can show a preview without the user re-teaching.

import type { SupplierPdfLayout, ImportFieldKey } from '../types';

export const applySavedLayout = (
  layout: SupplierPdfLayout,
  allPageText: PageTextData[]
): { fieldKey: ImportFieldKey; column: DetectedColumn | null }[] => {
  const results: { fieldKey: ImportFieldKey; column: DetectedColumn | null }[] = [];

  for (const savedCol of layout.columns) {
    const pageData = allPageText.find(p => p.page === savedCol.page);
    if (!pageData) {
      results.push({ fieldKey: savedCol.fieldKey, column: null });
      continue;
    }

    // Find a text item near the saved (x, y) position with matching text
    const POSITION_TOLERANCE = 15; // pdfjs points
    let bestItem: PdfTextItem | null = null;
    let bestDist = Infinity;

    for (const item of pageData.items) {
      const dist = Math.hypot(item.x - savedCol.x, item.y - savedCol.y);
      if (dist < bestDist && dist < POSITION_TOLERANCE) {
        // Prefer items with matching text, but allow position-only match
        if (item.str.trim().toLowerCase() === savedCol.headerText.toLowerCase()) {
          bestItem = item;
          bestDist = dist;
          break;
        }
        if (dist < bestDist) {
          bestItem = item;
          bestDist = dist;
        }
      }
    }

    if (bestItem) {
      const column = detectColumnFromHeader(bestItem, allPageText);
      results.push({ fieldKey: savedCol.fieldKey, column });
    } else {
      results.push({ fieldKey: savedCol.fieldKey, column: null });
    }
  }

  return results;
};

// ─── Build layout for saving ──────────────────────────────────────────────────
// Convert detected columns into a SupplierPdfLayout for persistence.

export const buildLayoutFromColumns = (
  supplierId: string,
  supplierName: string,
  supplierGstin: string | undefined,
  columns: { fieldKey: ImportFieldKey; column: DetectedColumn }[],
  metadata?: { invoiceNumber?: string; invoiceDate?: string; supplierName?: string; supplierGstin?: string }
): SupplierPdfLayout => {
  const now = new Date().toISOString();
  return {
    id: `pdf-layout-${supplierId}-${Date.now()}`,
    supplierId,
    supplierName,
    supplierGstin,
    columns: columns.map(({ fieldKey, column }) => ({
      fieldKey,
      headerText: column.headerItem.str.trim(),
      x: column.headerItem.x,
      y: column.headerItem.y,
      width: column.xEnd - column.xStart,
      page: column.page,
    })),
    metadata,
    createdAt: now,
    updatedAt: now,
    useCount: 1,
    lastUsedAt: now,
  };
};
