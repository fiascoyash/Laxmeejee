import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  QuotationTemplate, CompanyProfile, Customer, Quotation, Product,
  Invoice, GstMode, ThemeId, TemplateSettings,
  DEFAULT_TEMPLATE_SETTINGS, DEFAULT_TYPOGRAPHY_VALUES, TypographyElementId,
  TemplateSchema, UNIT_OPTIONS, INVOICE_THEMES, StyleTheme, StyleThemeId,
  DEFAULT_STYLE_THEME_ID, STYLE_THEMES, InvoiceTheme,
  A4_WIDTH, A4_HEIGHT, A5_WIDTH, A5_HEIGHT, POS_WIDTH,
} from '../types';
import {
  calculateProductAmount, calculateTaxSummary,
  calculateRoundOff, numberToWords, roundTo2, calculateGrandTotalAmount,
} from './storage';
import { getComplianceItemsForDocument } from './complianceDisplay';

export type DocumentType = 'quotation' | 'invoice';

// ─── Unit conversion constants ──────────────────────────────────────────────
// CSS px → mm: 1px = 25.4/96 = 0.2646mm  (96dpi standard)
const PX_TO_MM = 25.4 / 96;
// CSS px → pt: 1px = 72/96 = 0.75pt  (1pt = 1/72 inch, 1px = 1/96 inch)
const PX_TO_PT = 0.75;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (n: number) => n.toLocaleString('en-IN');

/** Convert a hex color (#RRGGBB) to an [r, g, b] array for jsPDF. */
const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
};

/** Get a typography value for a given element. Font sizes converted from px to pt. */
interface TypoVal { fontSizePt: number; fontWeight: number; color: string; }

const getTypo = (
  elementId: TypographyElementId,
  settings: TemplateSettings,
  fontScale: number,
): TypoVal => {
  const override = settings.typographyOverrides?.[elementId];
  const defaults = DEFAULT_TYPOGRAPHY_VALUES[elementId] || { fontSize: 12, fontWeight: 400, color: '#000000' };

  const rawFontSize = override?.usesGlobal === false
    ? (override.fontSize ?? defaults.fontSize)
    : (settings.globalDefaultFontSize ?? 12);
  // px → pt conversion, then apply paper-size font scale
  const fontSizePt = rawFontSize * PX_TO_PT * fontScale;

  const fontWeight = override?.usesGlobal === false
    ? (override.fontWeight ?? defaults.fontWeight)
    : defaults.fontWeight;

  const color = override?.usesGlobal === false
    ? (override.color ?? defaults.color)
    : defaults.color;

  return { fontSizePt, fontWeight, color };
};

/** Map CSS font-weight to jsPDF fontStyle string. */
const weightToStyle = (weight: number): 'normal' | 'bold' => {
  return weight >= 600 ? 'bold' : 'normal';
};

/** Convert CSS px to mm. */
const pxToMm = (px: number) => px * PX_TO_MM;

// ─── Main export entry point ─────────────────────────────────────────────────

export const exportTemplatePDF = async (
  template: QuotationTemplate,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType = 'quotation',
  invoice?: Invoice,
  gstMode: GstMode = 'inclusive',
) => {
  const themeId = (template as any).themeId as ThemeId | undefined;
  const settings = template.settings ?? DEFAULT_TEMPLATE_SETTINGS;
  const schema = template.schema;

  const resolvedThemeId: ThemeId = themeId ?? 'professional_corporate';
  const theme = INVOICE_THEMES[resolvedThemeId] ?? INVOICE_THEMES['professional_corporate'];
  const paperSize = theme.paperSize ?? 'a4';

  const fileName = documentType === 'invoice' && invoice ? invoice.invoiceNumber : quotation.quotationNumber;

  if (paperSize === 'pos') {
    // POS: measure content height first, then create doc with exact height
    const posFontScale = 0.5;
    const posMargin = pxToMm(16) * posFontScale;

    // Measurement pass — never saved, just calculates finalY
    const measureDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [POS_WIDTH, 297], compress: true });
    const finalY = await generateVectorPDF(measureDoc, resolvedThemeId, settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);

    const calculatedHeight = Math.max(finalY + posMargin, posMargin * 2);

    // Real render — single pass into correctly-sized doc
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [POS_WIDTH, calculatedHeight], compress: true });
    await generateVectorPDF(doc, resolvedThemeId, settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
    doc.save(`${fileName}.pdf`);
  } else {
    // A4/A5: single pass with fixed page size
    const pdfFormat = paperSize === 'a5' ? 'a5' as const : 'a4' as const;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: pdfFormat, compress: true });
    await generateVectorPDF(doc, resolvedThemeId, settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
    doc.save(`${fileName}.pdf`);
  }
};

// ─── Column visibility (mirrors DocumentRenderer.isColumnVisible) ─────────────

const isColumnVisible = (
  columnKey: string,
  docType: DocumentType,
  quotation: Quotation,
  invoice: Invoice | undefined,
  settings: TemplateSettings,
  schema: TemplateSchema | undefined,
): boolean => {
  const userColumns = docType === 'invoice' ? invoice?.productColumns : quotation.productColumns;
  if (userColumns && userColumns.length > 0) {
    const userCol = userColumns.find(c => c.key === columnKey);
    if (userCol) return userCol.visible !== false;
  }
  if (schema?.productColumns) {
    const schemaCol = schema.productColumns.find(c => c.key === columnKey);
    if (schemaCol) return schemaCol.visible !== false;
  }
  const settingsMap: Record<string, boolean> = {
    hsnSacCode: settings.showTax,
    batchNumber: settings.showBatchNumber,
    expiryDate: settings.showExpiryDate,
    mrp: false,
    quantityUnit: settings.showQuantity || settings.showUnit,
    discount: settings.showDiscount,
    gstPercent: settings.showTax,
    description: settings.showDescription,
    wattage: false,
    partNumber: false,
    vehicleModel: false,
    warrantyMonths: false,
  };
  return settingsMap[columnKey] ?? false;
};

// ─── POS Compact Bill Renderer (80mm thermal receipt layout) ──────────────────

const generatePosReceipt = (
  doc: jsPDF,
  settings: TemplateSettings,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType,
  invoice: Invoice | undefined,
  gstMode: GstMode,
  schema: TemplateSchema | undefined,
): number => {
  const margin = 3;
  const contentWidth = POS_WIDTH - margin * 2;
  const centerX = POS_WIDTH / 2;
  const rightX = POS_WIDTH - margin;

  const FS_COMPANY = 12;
  const FS_BODY = 8;
  const FS_SMALL = 7;
  const FS_TITLE = 10;
  const FS_TABLE = 7.5;
  const FS_TOTALS = 8;
  const FS_GRAND = 10;

  const lh = (pt: number) => pt * 0.3528;

  const styleThemeId: StyleThemeId = settings.styleThemeId ?? DEFAULT_STYLE_THEME_ID;
  const style: StyleTheme = STYLE_THEMES[styleThemeId] ?? STYLE_THEMES[DEFAULT_STYLE_THEME_ID];
  const primaryColor = hexToRgb(style.primaryColor);
  const secBorderColor = hexToRgb(style.sectionBorderColor);
  const tableBorderColor = hexToRgb(style.tableBorderColor);
  const tableHeaderBg = hexToRgb(style.tableHeaderBg);

  doc.setFont('helvetica');
  doc.setTextColor(0, 0, 0);

  const resolvedGstMode: GstMode = gstMode || quotation.gstMode || 'inclusive';
  const docLabel = documentType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber = documentType === 'invoice' ? invoice?.invoiceNumber ?? '' : quotation.quotationNumber;
  const docDate = documentType === 'invoice' ? invoice?.date ?? quotation.date : quotation.date;
  const dueDate = documentType === 'invoice' ? invoice?.dueDate : undefined;

  const taxSummary = calculateTaxSummary(products, resolvedGstMode);
  const totalTaxable = roundTo2(Array.from(taxSummary.values()).reduce((s, t) => s + t.taxableAmount, 0));
  const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((s, t) => s + t.cgstAmount, 0));
  const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((s, t) => s + t.sgstAmount, 0));
  const grandTotalRaw = calculateGrandTotalAmount(products, resolvedGstMode);
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalRaw);

  const gstColumnVisible = isColumnVisible('gstPercent', documentType, quotation, invoice, settings, schema);
  const hasAnyGst = products.some(p => (p.gstPercent || 0) > 0);
  const showGstDetails = gstColumnVisible && hasAnyGst;
  const showTaxSummary = settings.showTaxSummary !== false && showGstDetails;

  let y = margin;

  const drawSep = () => {
    doc.setDrawColor(...secBorderColor);
    doc.setLineWidth(0.2);
    doc.line(margin, y, POS_WIDTH - margin, y);
  };

  // ═══ SECTION 1: Header (centered) ═══
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS_COMPANY);
  doc.setTextColor(0, 0, 0);
  doc.text(company.companyName || 'Company Name', centerX, y + lh(FS_COMPANY) * 0.8, { align: 'center' });
  y += lh(FS_COMPANY) + 1;

  if (company.address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS_BODY);
    const addrLines = doc.splitTextToSize(company.address, contentWidth);
    doc.text(addrLines, centerX, y + lh(FS_BODY) * 0.8, { align: 'center' });
    y += addrLines.length * lh(FS_BODY) + 0.5;
  }

  if (settings.showGstin && company.gstNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_SMALL);
    doc.text(`GSTIN: ${company.gstNumber}`, centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
    y += lh(FS_SMALL) + 0.5;
  }

  for (const item of getComplianceItemsForDocument(company, documentType)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_SMALL);
    doc.text(`${item.label}: ${item.value}`, centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
    y += lh(FS_SMALL) + 0.5;
  }

  if (settings.showPhone && company.phone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS_SMALL);
    const contact = company.email ? `Mob: ${company.phone}  ${company.email}` : `Mob: ${company.phone}`;
    doc.text(contact, centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
    y += lh(FS_SMALL) + 1;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS_TITLE);
  doc.setTextColor(...primaryColor);
  doc.text(docLabel, centerX, y + lh(FS_TITLE) * 0.8, { align: 'center' });
  y += lh(FS_TITLE) + 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS_SMALL);
  doc.setTextColor(0, 0, 0);
  const origText = 'ORIGINAL FOR RECIPIENT';
  const origW = doc.getTextWidth(origText) + 4;
  const origH = lh(FS_SMALL) + 1.5;
  doc.setDrawColor(...secBorderColor);
  doc.setLineWidth(0.2);
  doc.rect(centerX - origW / 2, y, origW, origH, 'S');
  doc.text(origText, centerX, y + origH * 0.7, { align: 'center' });
  y += origH + 1;

  drawSep();
  y += 2;

  // ═══ SECTION 2: Meta (stacked, one per line) ═══
  const metaItems: { label: string; value: string }[] = [];
  if (documentType === 'invoice') {
    metaItems.push({ label: 'Invoice No.', value: docNumber });
    metaItems.push({ label: 'Date', value: docDate });
  } else {
    metaItems.push({ label: 'Quotation No.', value: docNumber });
    metaItems.push({ label: 'Date', value: docDate });
  }
  if (settings.showDueDate) metaItems.push({ label: 'Due Date', value: dueDate || '—' });
  if (settings.showPoNumber) metaItems.push({ label: 'PO Number', value: '—' });
  if (settings.showEwayBill) metaItems.push({ label: 'E-Way Bill', value: '—' });
  if (settings.showVehicleNumber) metaItems.push({ label: 'Vehicle No.', value: '—' });

  doc.setFontSize(FS_BODY);
  for (const item of metaItems) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(item.label, margin, y + lh(FS_BODY) * 0.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(item.value, rightX, y + lh(FS_BODY) * 0.8, { align: 'right' });
    y += lh(FS_BODY) + 1;
  }

  drawSep();
  y += 2;

  // ═══ SECTION 3: Bill To (stacked, full width) ═══
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS_BODY);
  doc.setTextColor(...primaryColor);
  doc.text('Bill To', margin, y + lh(FS_BODY) * 0.8);
  y += lh(FS_BODY) + 1;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(customer.name, margin, y + lh(FS_BODY) * 0.8);
  y += lh(FS_BODY) + 0.5;

  if (settings.showBillingAddress && customer.billingAddress) {
    doc.setFont('helvetica', 'normal');
    const addrLines = doc.splitTextToSize(customer.billingAddress, contentWidth);
    doc.text(addrLines, margin, y + lh(FS_BODY) * 0.8);
    y += addrLines.length * lh(FS_BODY) + 0.5;
  }

  if (customer.village || customer.district) {
    doc.setFont('helvetica', 'normal');
    const locLine = [customer.village, customer.district].filter(Boolean).join(', ');
    doc.text(locLine, margin, y + lh(FS_BODY) * 0.8);
    y += lh(FS_BODY) + 0.5;
  }

  if (settings.showPhone && customer.mobile) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Mob: ${customer.mobile}`, margin, y + lh(FS_BODY) * 0.8);
    y += lh(FS_BODY) + 0.5;
  }

  if (settings.showGstin && customer.gstNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${customer.gstNumber}`, margin, y + lh(FS_BODY) * 0.8);
    y += lh(FS_BODY) + 0.5;
  }

  drawSep();
  y += 2;

  // ═══ SECTION 4: Product Table (POS-optimized columns) ═══
  const showHsn = isColumnVisible('hsnSacCode', documentType, quotation, invoice, settings, schema);
  const showDisc = isColumnVisible('discount', documentType, quotation, invoice, settings, schema);
  const showQtyUnit = isColumnVisible('quantityUnit', documentType, quotation, invoice, settings, schema);
  const showDesc = isColumnVisible('description', documentType, quotation, invoice, settings, schema);

  const tableHead = [['Item', 'Qty', 'Rate', 'Amt']];
  const tableBody: string[][] = products.map((product) => {
    const amount = calculateProductAmount(product);
    const unitLabel = UNIT_OPTIONS.find(u => u.value === product.unit)?.label || 'Pc';

    let nameStr = product.name;
    const secondary: string[] = [];
    if (showHsn && product.hsnSacCode) secondary.push(`HSN: ${product.hsnSacCode}`);
    if (showDesc && product.description?.trim()) secondary.push(product.description.trim());
    if (showDisc && (product.discount ?? 0) > 0) secondary.push(`Disc: ${product.discount}%`);
    if (showGstDetails) secondary.push(`GST: ${product.gstPercent}%`);
    if (secondary.length > 0) nameStr += '\n' + secondary.join(' | ');

    const qtyStr = showQtyUnit ? `${product.quantity} ${unitLabel}` : String(product.quantity);
    return [nameStr, qtyStr, fmtInt(product.unitPrice), fmtInt(amount)];
  });

  if (products.length === 0) {
    tableBody.push(['No items added', '', '', '']);
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: tableHeaderBg,
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: FS_TABLE,
      halign: 'center',
      cellPadding: [1, 1] as any,
      lineColor: tableBorderColor,
      lineWidth: 0.1,
    },
    bodyStyles: {
      fontSize: FS_TABLE,
      textColor: [0, 0, 0],
      cellPadding: [1, 1] as any,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
    } as any,
    margin: { left: margin, right: margin, top: 0, bottom: 0 },
    tableWidth: contentWidth,
    tableLineColor: tableBorderColor,
    tableLineWidth: 0.1,
  });

  y = (doc as any).lastAutoTable?.finalY ?? y + 20;
  y += 1;

  // Line under table
  doc.setDrawColor(...tableBorderColor);
  doc.setLineWidth(0.2);
  doc.line(margin, y, POS_WIDTH - margin, y);
  y += 2;

  // ═══ SECTION 5: Tax Summary (compact, one line per slab) ═══
  if (showTaxSummary) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_SMALL);
    doc.setTextColor(...primaryColor);
    doc.text('Tax Summary', margin, y + lh(FS_SMALL) * 0.8);
    y += lh(FS_SMALL) + 1;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    for (const [key, data] of taxSummary) {
      const rate = key.split('_')[1];
      const line = `${data.hsnSacCode || '—'} | ${rate}% | Tax: Rs.${fmt(data.taxableAmount)} | CGST: Rs.${fmt(data.cgstAmount)} | SGST: Rs.${fmt(data.sgstAmount)}`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      doc.text(wrapped, margin, y + lh(FS_SMALL) * 0.8);
      y += wrapped.length * lh(FS_SMALL) + 0.5;
    }
    y += 1;
  }

  // ═══ SECTION 6: Totals (right-aligned, full width) ═══
  const drawTotalLine = (label: string, value: string, bold = false) => {
    const fs = bold ? FS_GRAND : FS_TOTALS;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fs);
    doc.setTextColor(0, 0, 0);
    doc.text(label, margin, y + lh(fs) * 0.8);
    doc.text(value, rightX, y + lh(fs) * 0.8, { align: 'right' });
    y += lh(fs) + 1;
  };

  drawTotalLine('Sub Total', `Rs. ${fmt(totalTaxable)}`);
  if (showGstDetails) {
    drawTotalLine('CGST', `Rs. ${fmt(totalCgst)}`);
    drawTotalLine('SGST', `Rs. ${fmt(totalSgst)}`);
  }
  if (roundOff !== 0) {
    drawTotalLine('Round Off', `Rs. ${fmt(roundOff)}`);
  }

  doc.setDrawColor(...secBorderColor);
  doc.setLineWidth(0.4);
  doc.line(margin, y, rightX, y);
  y += 2;

  drawTotalLine('GRAND TOTAL', `Rs. ${fmt(roundedGrandTotal)}`, true);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(FS_SMALL);
  doc.setTextColor(80, 80, 80);
  const wordsText = `(${numberToWords(roundedGrandTotal)})`;
  const wordsLines = doc.splitTextToSize(wordsText, contentWidth);
  doc.text(wordsLines, centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
  y += wordsLines.length * lh(FS_SMALL) + 2;

  drawSep();
  y += 2;

  // ═══ SECTION 7: Notes ═══
  if (settings.showNotes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_BODY);
    doc.setTextColor(...primaryColor);
    doc.text('Notes', margin, y + lh(FS_BODY) * 0.8);
    y += lh(FS_BODY) + 1;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const notesText = quotation.notes || 'Thank you for your business!';
    const notesLines = doc.splitTextToSize(notesText, contentWidth);
    doc.text(notesLines, margin, y + lh(FS_BODY) * 0.8);
    y += notesLines.length * lh(FS_BODY) + 2;

    drawSep();
    y += 2;
  }

  // ═══ SECTION 8: Bank Details (stacked) ═══
  if (settings.showBankDetails) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_BODY);
    doc.setTextColor(...primaryColor);
    doc.text('Bank Details', margin, y + lh(FS_BODY) * 0.8);
    y += lh(FS_BODY) + 1;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    if (company.bankName) {
      doc.text(`Bank: ${company.bankName}`, margin, y + lh(FS_BODY) * 0.8);
      y += lh(FS_BODY) + 0.5;
    }
    if (company.bankAccount) {
      doc.text(`A/c: ${company.bankAccount}`, margin, y + lh(FS_BODY) * 0.8);
      y += lh(FS_BODY) + 0.5;
    }
    if (company.bankIfsc) {
      doc.text(`IFSC: ${company.bankIfsc}`, margin, y + lh(FS_BODY) * 0.8);
      y += lh(FS_BODY) + 0.5;
    }
    if (company.bankBranch) {
      doc.text(`Branch: ${company.bankBranch}`, margin, y + lh(FS_BODY) * 0.8);
      y += lh(FS_BODY) + 0.5;
    }

    drawSep();
    y += 2;
  }

  // ═══ SECTION 9: QR Code (centered) ═══
  if (settings.showPaymentQr) {
    if (quotation.paymentQr) {
      try {
        const qrSize = 20;
        const qrX = centerX - qrSize / 2;
        const isJpeg = quotation.paymentQr.startsWith('data:image/jpeg') || quotation.paymentQr.startsWith('data:image/jpg');
        doc.addImage(quotation.paymentQr, isJpeg ? 'JPEG' : 'PNG', qrX, y, qrSize, qrSize, undefined, 'FAST');
        y += qrSize + 1;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FS_SMALL);
        doc.setTextColor(0, 0, 0);
        doc.text('Scan to Pay', centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
        y += lh(FS_SMALL) + 2;
      } catch { /* skip */ }
    }
    drawSep();
    y += 2;
  }

  // ═══ SECTION 10: Signature (centered) ═══
  if (settings.showSignature) {
    const signatureImg = quotation.signature || company.signature;
    const sigWidth = contentWidth * 0.5;
    const sigX = centerX - sigWidth / 2;
    const sigImgHeight = 15;

    if (signatureImg) {
      try {
        const isJpeg = signatureImg.startsWith('data:image/jpeg') || signatureImg.startsWith('data:image/jpg');
        doc.addImage(signatureImg, isJpeg ? 'JPEG' : 'PNG', sigX, y, sigWidth * 0.6, sigImgHeight, undefined, 'FAST');
      } catch { /* skip */ }
    }

    y += sigImgHeight + 1;
    doc.setDrawColor(...secBorderColor);
    doc.setLineWidth(0.2);
    doc.line(sigX, y, sigX + sigWidth, y);
    y += 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS_SMALL);
    doc.setTextColor(0, 0, 0);
    doc.text('Authorised Signatory', centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
    y += lh(FS_SMALL) + 2;

    drawSep();
    y += 2;
  }

  // ═══ SECTION 11: Terms & Conditions ═══
  if (settings.showTermsConditions) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS_BODY);
    doc.setTextColor(...primaryColor);
    doc.text('Terms & Conditions', margin, y + lh(FS_BODY) * 0.8);
    y += lh(FS_BODY) + 1;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(FS_SMALL);
    const termsText = quotation.terms ||
      '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.';
    const termsLines = termsText.split('\n');
    for (const line of termsLines) {
      const wrapped = doc.splitTextToSize(line, contentWidth);
      doc.text(wrapped, margin, y + lh(FS_SMALL) * 0.8);
      y += wrapped.length * lh(FS_SMALL) + 0.5;
    }

    y += 1;
    drawSep();
    y += 2;
  }

  // ═══ SECTION 12: Footer Strip (centered) ═══
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS_SMALL);
  doc.setTextColor(120, 120, 120);
  doc.text('Computer-generated document. No signature required.', centerX, y + lh(FS_SMALL) * 0.8, { align: 'center' });
  y += lh(FS_SMALL) + 2;

  return y;
};

// ─── Vector PDF Generator ────────────────────────────────────────────────────

const generateVectorPDF = async (
  doc: jsPDF,
  themeId: ThemeId,
  settings: TemplateSettings,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType,
  invoice: Invoice | undefined,
  gstMode: GstMode,
  schema: TemplateSchema | undefined,
) => {
  const theme: InvoiceTheme = INVOICE_THEMES[themeId] ?? INVOICE_THEMES['professional_corporate'];

  // POS uses a dedicated thermal receipt layout — not a scaled-down A4
  if (theme.paperSize === 'pos') {
    return generatePosReceipt(doc, settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
  }
  const styleThemeId: StyleThemeId = settings.styleThemeId ?? DEFAULT_STYLE_THEME_ID;
  const style: StyleTheme = STYLE_THEMES[styleThemeId] ?? STYLE_THEMES[DEFAULT_STYLE_THEME_ID];

  const paperSize = theme.paperSize ?? 'a4';

  // Paper dimensions and font scaling (mirrors DocumentRenderer)
  let paperWidth: number;
  let pageHeight: number;
  let fontScale: number;

  switch (paperSize) {
    case 'a5':
      paperWidth = A5_WIDTH;
      pageHeight = A5_HEIGHT;
      fontScale = 0.72;
      break;
    default: // a4
      paperWidth = A4_WIDTH;
      pageHeight = A4_HEIGHT;
      fontScale = 1;
  }

  // Margins — mirrors DocumentRenderer section padding (16px ≈ 4.23mm)
  const margin = pxToMm(16) * fontScale;
  const contentWidth = paperWidth - margin * 2;

  // Pre-compute colors as tuples
  const secBorderColor: [number, number, number] = hexToRgb(style.sectionBorderColor);
  const tableBorderColor: [number, number, number] = hexToRgb(style.tableBorderColor);
  const primaryColor: [number, number, number] = hexToRgb(style.primaryColor);
  const tableHeaderBg: [number, number, number] = hexToRgb(style.tableHeaderBg);
  const headerBgRgb: [number, number, number] = hexToRgb(style.headerBg);

  doc.setFont('helvetica');
  doc.setTextColor(0, 0, 0);

  // GST mode
  const resolvedGstMode: GstMode = gstMode || quotation.gstMode || 'inclusive';

  // Document metadata
  const docLabel = documentType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber = documentType === 'invoice' ? invoice?.invoiceNumber ?? '' : quotation.quotationNumber;
  const docDate = documentType === 'invoice' ? invoice?.date ?? quotation.date : quotation.date;
  const dueDate = documentType === 'invoice' ? invoice?.dueDate : undefined;

  // Calculations (mirrors DocumentRenderer exactly)
  const taxSummary = calculateTaxSummary(products, resolvedGstMode);
  const totalTaxable = roundTo2(
    Array.from(taxSummary.values()).reduce((s, t) => s + t.taxableAmount, 0),
  );
  const totalCgst = roundTo2(
    Array.from(taxSummary.values()).reduce((s, t) => s + t.cgstAmount, 0),
  );
  const totalSgst = roundTo2(
    Array.from(taxSummary.values()).reduce((s, t) => s + t.sgstAmount, 0),
  );
  const grandTotalRaw = calculateGrandTotalAmount(products, resolvedGstMode);
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalRaw);

  // Column visibility
  const gstColumnVisible = isColumnVisible('gstPercent', documentType, quotation, invoice, settings, schema);
  const hasAnyGst = products.some(p => (p.gstPercent || 0) > 0);
  const showGstDetails = gstColumnVisible && hasAnyGst;
  const showTaxSummary = settings.showTaxSummary !== false && showGstDetails;

  const hasShipTo =
    settings.showShippingAddress &&
    !!(quotation.shipTo?.name?.trim() || quotation.shipTo?.address?.trim());

  const hasDarkHeader = style.headerBg !== '#FFFFFF' && style.headerBg !== '#F8FAFC' && style.headerBg !== '#F9FAFB';
  const headerTextColorRgb: [number, number, number] = hasDarkHeader ? [255, 255, 255] : hexToRgb(style.headerTextColor);

  // ── Track current Y position ────────────────────────────────────────────
  let y = margin;

  // Helper: draw a horizontal section border line
  const drawSecBorder = (yPos: number) => {
    doc.setDrawColor(...secBorderColor);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, paperWidth - margin, yPos);
  };

  // Helper: add a new page if content overflows
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Helper: set font with typo values
  const setFont = (typo: TypoVal, italic = false) => {
    const fs = weightToStyle(typo.fontWeight);
    doc.setFont('helvetica', italic ? (fs === 'bold' ? 'bolditalic' : 'italic') : fs);
    doc.setFontSize(typo.fontSizePt);
    const [r, g, b] = hexToRgb(typo.color);
    doc.setTextColor(r, g, b);
  };

  // Helper: line height in mm for a given font size (pt)
  const lineHeightMm = (pt: number) => pt * 0.3528; // 1pt = 0.3528mm

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 1: Company Header
  // ═══════════════════════════════════════════════════════════════════════

  const headerAlign = settings.headerAlignment ?? 'left';
  const headerPadPx = 14; // top padding from DocumentRenderer pad('14px 16px 12px')
  const headerPadTop = pxToMm(headerPadPx) * fontScale;
  const headerPadSide = pxToMm(16) * fontScale;
  const headerPadBottom = pxToMm(12) * fontScale;

  // Pre-calculate all typography for header
  const companyNameTypo = getTypo('company_name', settings, fontScale);
  const companyAddrTypo = getTypo('company_address', settings, fontScale);
  const companyGstinTypo = getTypo('company_gstin', settings, fontScale);
  const companyPhoneTypo = getTypo('company_phone', settings, fontScale);
  const docTitleTypo = getTypo('doc_title', settings, fontScale);
  const origForRecTypo = getTypo('original_for_recipient', settings, fontScale);

  // Calculate dynamic header height based on content
  const headerLineGap = pxToMm(3) * fontScale; // marginTop: 3px in preview
  let headerContentHeight = lineHeightMm(companyNameTypo.fontSizePt);
  if (company.address) {
    const addrLines = Math.ceil(doc.splitTextToSize(company.address, contentWidth * 0.55).length);
    headerContentHeight += headerLineGap + addrLines * lineHeightMm(companyAddrTypo.fontSizePt);
  }
  if (settings.showGstin && company.gstNumber) {
    headerContentHeight += headerLineGap + lineHeightMm(companyGstinTypo.fontSizePt);
  }
  const complianceItems = getComplianceItemsForDocument(company, documentType);
  for (const _ of complianceItems) {
    headerContentHeight += headerLineGap + lineHeightMm(companyGstinTypo.fontSizePt);
  }
  if (settings.showPhone && company.phone) {
    headerContentHeight += pxToMm(2) * fontScale + lineHeightMm(companyPhoneTypo.fontSizePt);
  }
  // Doc title + original for recipient on right side
  const rightSideHeight = lineHeightMm(docTitleTypo.fontSizePt) + pxToMm(3) * fontScale + lineHeightMm(origForRecTypo.fontSizePt) + 2;
  const headerHeight = headerPadTop + Math.max(headerContentHeight, rightSideHeight) + headerPadBottom;

  // Fill header background
  doc.setFillColor(...headerBgRgb);
  doc.rect(margin, y, contentWidth, headerHeight, 'F');

  // Logo
  const logoW = pxToMm(52) * fontScale;
  const logoH = pxToMm(42) * fontScale;
  let logoX = margin + headerPadSide;
  const logoY = y + headerPadTop;

  if (company.logo) {
    try {
      // Try to detect format from data URL
      const isJpeg = company.logo.startsWith('data:image/jpeg') || company.logo.startsWith('data:image/jpg');
      const fmt = isJpeg ? 'JPEG' : 'PNG';
      doc.addImage(company.logo, fmt, logoX, logoY, logoW, logoH, undefined, 'FAST');
    } catch {
      // Skip if image can't be added
    }
  }

  // Company info text start X
  const textX = company.logo ? logoX + logoW + pxToMm(12) * fontScale : margin + headerPadSide;
  const rightX = paperWidth - margin - headerPadSide;

  // Dark header color helper
  const docTitleColor: [number, number, number] = hasDarkHeader ? [255, 255, 255] : primaryColor;

  if (headerAlign === 'center') {
    const centerX = paperWidth / 2;
    let cy = y + headerPadTop;

    // Doc title centered at top
    setFont(docTitleTypo);
    doc.setTextColor(...docTitleColor);
    doc.text(docLabel, centerX, cy + lineHeightMm(docTitleTypo.fontSizePt) * 0.8, { align: 'center' });
    cy += lineHeightMm(docTitleTypo.fontSizePt) + pxToMm(6) * fontScale;

    // Company name
    setFont(companyNameTypo);
    doc.setTextColor(...headerTextColorRgb);
    doc.text(company.companyName || 'Company Name', centerX, cy + lineHeightMm(companyNameTypo.fontSizePt) * 0.8, { align: 'center' });
    cy += lineHeightMm(companyNameTypo.fontSizePt) + headerLineGap;

    if (company.address) {
      setFont(companyAddrTypo);
      const addrLines = doc.splitTextToSize(company.address, contentWidth * 0.6);
      doc.text(addrLines, centerX, cy + lineHeightMm(companyAddrTypo.fontSizePt) * 0.8, { align: 'center' });
      cy += addrLines.length * lineHeightMm(companyAddrTypo.fontSizePt) + headerLineGap;
    }
    if (settings.showGstin && company.gstNumber) {
      setFont(companyGstinTypo);
      doc.text(`GSTIN ${company.gstNumber}`, centerX, cy + lineHeightMm(companyGstinTypo.fontSizePt) * 0.8, { align: 'center' });
      cy += lineHeightMm(companyGstinTypo.fontSizePt) + headerLineGap;
    }
    for (const item of complianceItems) {
      setFont(companyGstinTypo);
      doc.text(`${item.label} ${item.value}`, centerX, cy + lineHeightMm(companyGstinTypo.fontSizePt) * 0.8, { align: 'center' });
      cy += lineHeightMm(companyGstinTypo.fontSizePt) + headerLineGap;
    }
    if (settings.showPhone && company.phone) {
      setFont(companyPhoneTypo);
      const phoneLine = company.email ? `Phone: ${company.phone}  Email: ${company.email}` : `Phone: ${company.phone}`;
      doc.text(phoneLine, centerX, cy + lineHeightMm(companyPhoneTypo.fontSizePt) * 0.8, { align: 'center' });
    }

    // Original for recipient — top right
    setFont(origForRecTypo);
    doc.setTextColor(...docTitleColor);
    const origText = 'ORIGINAL FOR RECIPIENT';
    const origW = doc.getTextWidth(origText) + pxToMm(14) * fontScale;
    const origH = lineHeightMm(origForRecTypo.fontSizePt) + pxToMm(2) * fontScale;
    doc.rect(rightX - origW, y + headerPadTop, origW, origH, 'S');
    doc.text(origText, rightX - origW / 2, y + headerPadTop + origH * 0.7, { align: 'center' });

  } else if (headerAlign === 'right') {
    // Right alignment: doc type on left, company on right
    let leftY = y + headerPadTop;
    setFont(docTitleTypo);
    doc.setTextColor(...docTitleColor);
    doc.text(docLabel, margin + headerPadSide, leftY + lineHeightMm(docTitleTypo.fontSizePt) * 0.8);
    leftY += lineHeightMm(docTitleTypo.fontSizePt) + pxToMm(3) * fontScale;

    setFont(origForRecTypo);
    const origText = 'ORIGINAL FOR RECIPIENT';
    const origW = doc.getTextWidth(origText) + pxToMm(14) * fontScale;
    const origH = lineHeightMm(origForRecTypo.fontSizePt) + pxToMm(2) * fontScale;
    doc.rect(margin + headerPadSide, leftY, origW, origH, 'S');
    doc.text(origText, margin + headerPadSide + origW / 2, leftY + origH * 0.7, { align: 'center' });

    // Company info on right
    let cy = y + headerPadTop;
    setFont(companyNameTypo);
    doc.setTextColor(...headerTextColorRgb);
    doc.text(company.companyName || 'Company Name', rightX, cy + lineHeightMm(companyNameTypo.fontSizePt) * 0.8, { align: 'right' });
    cy += lineHeightMm(companyNameTypo.fontSizePt) + headerLineGap;

    if (company.address) {
      setFont(companyAddrTypo);
      const addrLines = doc.splitTextToSize(company.address, contentWidth * 0.55);
      doc.text(addrLines, rightX, cy + lineHeightMm(companyAddrTypo.fontSizePt) * 0.8, { align: 'right' });
      cy += addrLines.length * lineHeightMm(companyAddrTypo.fontSizePt) + headerLineGap;
    }
    if (settings.showGstin && company.gstNumber) {
      setFont(companyGstinTypo);
      doc.text(`GSTIN ${company.gstNumber}`, rightX, cy + lineHeightMm(companyGstinTypo.fontSizePt) * 0.8, { align: 'right' });
      cy += lineHeightMm(companyGstinTypo.fontSizePt) + headerLineGap;
    }
    for (const item of complianceItems) {
      setFont(companyGstinTypo);
      doc.text(`${item.label} ${item.value}`, rightX, cy + lineHeightMm(companyGstinTypo.fontSizePt) * 0.8, { align: 'right' });
      cy += lineHeightMm(companyGstinTypo.fontSizePt) + headerLineGap;
    }
    if (settings.showPhone && company.phone) {
      setFont(companyPhoneTypo);
      const phoneLine = company.email ? `Phone: ${company.phone}  Email: ${company.email}` : `Phone: ${company.phone}`;
      doc.text(phoneLine, rightX, cy + lineHeightMm(companyPhoneTypo.fontSizePt) * 0.8, { align: 'right' });
    }

  } else {
    // Left alignment (default): company on left, doc type on right
    let cy = y + headerPadTop;
    setFont(companyNameTypo);
    doc.setTextColor(...headerTextColorRgb);
    doc.text(company.companyName || 'Company Name', textX, cy + lineHeightMm(companyNameTypo.fontSizePt) * 0.8);
    cy += lineHeightMm(companyNameTypo.fontSizePt) + headerLineGap;

    if (company.address) {
      setFont(companyAddrTypo);
      const addrLines = doc.splitTextToSize(company.address, contentWidth * 0.55);
      doc.text(addrLines, textX, cy + lineHeightMm(companyAddrTypo.fontSizePt) * 0.8);
      cy += addrLines.length * lineHeightMm(companyAddrTypo.fontSizePt) + headerLineGap;
    }
    if (settings.showGstin && company.gstNumber) {
      setFont(companyGstinTypo);
      doc.text(`GSTIN ${company.gstNumber}`, textX, cy + lineHeightMm(companyGstinTypo.fontSizePt) * 0.8);
      cy += lineHeightMm(companyGstinTypo.fontSizePt) + headerLineGap;
    }
    for (const item of complianceItems) {
      setFont(companyGstinTypo);
      doc.text(`${item.label} ${item.value}`, textX, cy + lineHeightMm(companyGstinTypo.fontSizePt) * 0.8);
      cy += lineHeightMm(companyGstinTypo.fontSizePt) + headerLineGap;
    }
    if (settings.showPhone && company.phone) {
      setFont(companyPhoneTypo);
      const phoneLine = company.email ? `Phone: ${company.phone}  Email: ${company.email}` : `Phone: ${company.phone}`;
      doc.text(phoneLine, textX, cy + lineHeightMm(companyPhoneTypo.fontSizePt) * 0.8);
    }

    // Doc type on right
    setFont(docTitleTypo);
    doc.setTextColor(...docTitleColor);
    doc.text(docLabel, rightX, y + headerPadTop + lineHeightMm(docTitleTypo.fontSizePt) * 0.8, { align: 'right' });

    setFont(origForRecTypo);
    const origText = 'ORIGINAL FOR RECIPIENT';
    const origW = doc.getTextWidth(origText) + pxToMm(14) * fontScale;
    const origH = lineHeightMm(origForRecTypo.fontSizePt) + pxToMm(2) * fontScale;
    doc.rect(rightX - origW, y + headerPadTop + lineHeightMm(docTitleTypo.fontSizePt) + pxToMm(3) * fontScale, origW, origH, 'S');
    doc.text(origText, rightX - origW / 2, y + headerPadTop + lineHeightMm(docTitleTypo.fontSizePt) + pxToMm(3) * fontScale + origH * 0.7, { align: 'center' });
  }

  y += headerHeight;

  // Accent bar (for themes that have it)
  if (theme.accentBar) {
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - pxToMm(3) * fontScale, contentWidth, pxToMm(3) * fontScale, 'F');
  }

  drawSecBorder(y);
  y += pxToMm(1);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 2: Invoice Meta
  // ═══════════════════════════════════════════════════════════════════════

  ensureSpace(12);
  const metaPadTop = pxToMm(8) * fontScale;
  const metaPadSide = pxToMm(16) * fontScale;
  y += metaPadTop;

  const metaCells: { label: string; value: string; labelId: TypographyElementId; valueId: TypographyElementId; highlight?: boolean }[] = [];

  if (documentType === 'invoice') {
    metaCells.push({ label: 'Invoice No.', value: docNumber, labelId: 'invoice_number_label', valueId: 'invoice_number_value' });
    metaCells.push({ label: 'Invoice Date', value: docDate, labelId: 'invoice_date_label', valueId: 'invoice_date_value' });
  } else {
    metaCells.push({ label: 'Quotation No.', value: docNumber, labelId: 'quotation_number_label', valueId: 'quotation_number_value' });
    metaCells.push({ label: 'Quotation Date', value: docDate, labelId: 'quotation_date_label', valueId: 'quotation_date_value' });
  }

  if (settings.showDueDate) {
    metaCells.push({ label: 'Due Date', value: dueDate || '—', labelId: 'due_date_label', valueId: 'due_date_value', highlight: !!dueDate });
  }
  if (settings.showPoNumber) {
    metaCells.push({ label: 'PO Number', value: '—', labelId: 'po_number_label', valueId: 'po_number_value' });
  }
  if (settings.showEwayBill) {
    metaCells.push({ label: 'E-Way Bill', value: '—', labelId: 'eway_bill_label', valueId: 'eway_bill_value' });
  }
  if (settings.showVehicleNumber) {
    metaCells.push({ label: 'Vehicle No.', value: '—', labelId: 'vehicle_number_label', valueId: 'vehicle_number_value' });
  }

  // Render meta cells in a flex-wrap-like layout
  const metaGap = pxToMm(28) * fontScale; // gap from DocumentRenderer
  let metaCellX = margin + metaPadSide;
  const metaLineHeight = lineHeightMm(getTypo(metaCells[0].valueId, settings, fontScale).fontSizePt);
  const metaCellHeight = lineHeightMm(getTypo(metaCells[0].labelId, settings, fontScale).fontSizePt) + pxToMm(2) * fontScale + metaLineHeight;
  let metaRowStartY = y;

  for (const cell of metaCells) {
    const labelTypo = getTypo(cell.labelId, settings, fontScale);
    const valueTypo = getTypo(cell.valueId, settings, fontScale);

    setFont(labelTypo);
    const labelW = doc.getTextWidth(cell.label);
    setFont(valueTypo);
    const valueW = doc.getTextWidth(cell.value);
    const cellW = Math.max(labelW, valueW);

    if (metaCellX + cellW > paperWidth - margin - metaPadSide) {
      // Wrap to next line
      metaCellX = margin + metaPadSide;
      metaRowStartY += metaCellHeight + pxToMm(2) * fontScale;
    }

    setFont(labelTypo);
    doc.text(cell.label, metaCellX, metaRowStartY + lineHeightMm(labelTypo.fontSizePt) * 0.8);

    setFont(valueTypo);
    if (cell.highlight) {
      doc.setTextColor(...primaryColor);
    }
    doc.text(cell.value, metaCellX, metaRowStartY + lineHeightMm(labelTypo.fontSizePt) + pxToMm(2) * fontScale + metaLineHeight * 0.8);

    metaCellX += cellW + metaGap;
  }

  y = metaRowStartY + metaCellHeight + metaPadTop;
  drawSecBorder(y);
  y += pxToMm(1);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 3: Bill To / Ship To
  // ═══════════════════════════════════════════════════════════════════════

  ensureSpace(20);
  const partyPadTop = pxToMm(10) * fontScale;
  const partyPadSide = pxToMm(16) * fontScale;
  y += partyPadTop;

  const partyWidth = hasShipTo ? contentWidth / 2 : contentWidth;
  const billToX = margin + partyPadSide;
  const shipToX = margin + partyWidth + partyPadSide;
  const partyContentWidth = partyWidth - partyPadSide * 2;

  // Bill To label
  const billToLabelTypo = getTypo('bill_to_label', settings, fontScale);
  setFont(billToLabelTypo);
  doc.setTextColor(...primaryColor);
  doc.text('Bill To', billToX, y + lineHeightMm(billToLabelTypo.fontSizePt) * 0.8);

  // Bill To name
  const billToNameTypo = getTypo('bill_to_name', settings, fontScale);
  setFont(billToNameTypo);
  doc.setTextColor(0, 0, 0);
  let billToY = y + lineHeightMm(billToLabelTypo.fontSizePt) + pxToMm(4) * fontScale;
  doc.text(customer.name, billToX, billToY + lineHeightMm(billToNameTypo.fontSizePt) * 0.8);
  billToY += lineHeightMm(billToNameTypo.fontSizePt) + pxToMm(2) * fontScale;

  if (settings.showBillingAddress && customer.billingAddress) {
    const billToAddrTypo = getTypo('bill_to_address', settings, fontScale);
    setFont(billToAddrTypo);
    const addrLines = doc.splitTextToSize(customer.billingAddress, partyContentWidth);
    doc.text(addrLines, billToX, billToY + lineHeightMm(billToAddrTypo.fontSizePt) * 0.8);
    billToY += addrLines.length * lineHeightMm(billToAddrTypo.fontSizePt) + pxToMm(2) * fontScale;
  }

  if (customer.village || customer.district) {
    const billToAddrTypo = getTypo('bill_to_address', settings, fontScale);
    setFont(billToAddrTypo);
    const locLine = [customer.village, customer.district].filter(Boolean).join(', ');
    doc.text(locLine, billToX, billToY + lineHeightMm(billToAddrTypo.fontSizePt) * 0.8);
    billToY += lineHeightMm(billToAddrTypo.fontSizePt) + pxToMm(2) * fontScale;
  }

  if (settings.showPhone && customer.mobile) {
    const billToPhoneTypo = getTypo('bill_to_phone', settings, fontScale);
    setFont(billToPhoneTypo);
    doc.text(`Mobile ${customer.mobile}`, billToX, billToY + lineHeightMm(billToPhoneTypo.fontSizePt) * 0.8);
    billToY += lineHeightMm(billToPhoneTypo.fontSizePt) + pxToMm(2) * fontScale;
  }

  if (settings.showGstin && customer.gstNumber) {
    const billToGstinTypo = getTypo('bill_to_gstin', settings, fontScale);
    setFont(billToGstinTypo);
    doc.text(`GSTIN ${customer.gstNumber}`, billToX, billToY + lineHeightMm(billToGstinTypo.fontSizePt) * 0.8);
    billToY += lineHeightMm(billToGstinTypo.fontSizePt) + pxToMm(2) * fontScale;
  }

  // Ship To
  let shipToY = y;
  if (hasShipTo) {
    // Divider
    doc.setDrawColor(...secBorderColor);
    doc.setLineWidth(0.2);
    doc.line(margin + partyWidth, y - partyPadTop, margin + partyWidth, Math.max(billToY, y + pxToMm(60) * fontScale));

    const shipToLabelTypo = getTypo('ship_to_label', settings, fontScale);
    setFont(shipToLabelTypo);
    doc.setTextColor(...primaryColor);
    doc.text('Ship To', shipToX, y + lineHeightMm(shipToLabelTypo.fontSizePt) * 0.8);

    shipToY = y + lineHeightMm(shipToLabelTypo.fontSizePt) + pxToMm(4) * fontScale;

    if (quotation.shipTo?.name) {
      const shipToNameTypo = getTypo('ship_to_name', settings, fontScale);
      setFont(shipToNameTypo);
      doc.setTextColor(0, 0, 0);
      doc.text(quotation.shipTo.name, shipToX, shipToY + lineHeightMm(shipToNameTypo.fontSizePt) * 0.8);
      shipToY += lineHeightMm(shipToNameTypo.fontSizePt) + pxToMm(2) * fontScale;
    }

    if (quotation.shipTo?.address) {
      const shipToAddrTypo = getTypo('ship_to_address', settings, fontScale);
      setFont(shipToAddrTypo);
      const addrLines = doc.splitTextToSize(quotation.shipTo.address, partyContentWidth);
      doc.text(addrLines, shipToX, shipToY + lineHeightMm(shipToAddrTypo.fontSizePt) * 0.8);
      shipToY += addrLines.length * lineHeightMm(shipToAddrTypo.fontSizePt) + pxToMm(2) * fontScale;
    }

    if (settings.showPhone && quotation.shipTo?.mobile) {
      const shipToPhoneTypo = getTypo('ship_to_phone', settings, fontScale);
      setFont(shipToPhoneTypo);
      doc.text(`Mobile ${quotation.shipTo.mobile}`, shipToX, shipToY + lineHeightMm(shipToPhoneTypo.fontSizePt) * 0.8);
      shipToY += lineHeightMm(shipToPhoneTypo.fontSizePt) + pxToMm(2) * fontScale;
    }

    if (settings.showGstin && quotation.shipTo?.gstNumber) {
      const shipToGstinTypo = getTypo('ship_to_gstin', settings, fontScale);
      setFont(shipToGstinTypo);
      doc.text(`GSTIN ${quotation.shipTo.gstNumber}`, shipToX, shipToY + lineHeightMm(shipToGstinTypo.fontSizePt) * 0.8);
      shipToY += lineHeightMm(shipToGstinTypo.fontSizePt) + pxToMm(2) * fontScale;
    }
  }

  y = Math.max(billToY, shipToY, y + pxToMm(60) * fontScale);
  y += partyPadTop;
  drawSecBorder(y);
  y += pxToMm(1);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 4: Product Table (using autoTable)
  // ═══════════════════════════════════════════════════════════════════════

  const tableHeaderTypo = getTypo('table_header', settings, fontScale);
  const productRowTypo = getTypo('product_row', settings, fontScale);

  // Cell padding from DocumentRenderer: cellPad = '6px 8px' * fontScale
  const cellPadY = pxToMm(6) * fontScale;
  const cellPadX = pxToMm(8) * fontScale;

  // Column definitions — widths converted from px to mm (matching DocumentRenderer colW)
  const colWmm = (px: number) => pxToMm(px) * fontScale;

  const columns: { header: string; key: string; width: number; align: 'left' | 'center' | 'right' }[] = [
    { header: 'No', key: 'srNo', width: colWmm(32), align: 'center' },
    { header: 'Items', key: 'name', width: 0, align: 'left' },
  ];

  const addOptionalCol = (key: string, header: string, widthPx: number) => {
    if (isColumnVisible(key, documentType, quotation, invoice, settings, schema)) {
      columns.push({ header, key, width: colWmm(widthPx), align: 'right' });
    }
  };

  addOptionalCol('hsnSacCode', 'HSN/SAC', 72);
  addOptionalCol('wattage', 'Wattage', 72);
  addOptionalCol('partNumber', 'Part No.', 72);
  addOptionalCol('vehicleModel', 'Vehicle', 80);
  addOptionalCol('mrp', 'MRP', 72);
  addOptionalCol('batchNumber', 'Batch No.', 72);
  addOptionalCol('expiryDate', 'Expiry', 80);
  addOptionalCol('warrantyMonths', 'Warranty', 72);
  addOptionalCol('quantityUnit', 'Qty/Unit', 80);

  columns.push({ header: 'Rate', key: 'rate', width: colWmm(76), align: 'right' });

  if (isColumnVisible('discount', documentType, quotation, invoice, settings, schema)) {
    columns.push({ header: 'Disc.', key: 'discount', width: colWmm(70), align: 'right' });
  }
  if (gstColumnVisible) {
    columns.push({ header: 'Tax', key: 'tax', width: colWmm(76), align: 'right' });
  }
  columns.push({ header: 'Total', key: 'amount', width: colWmm(84), align: 'right' });

  // Build table data
  const head = [columns.map(c => c.header)];
  const body: (string | number)[][] = products.map((product, i) => {
    const amount = calculateProductAmount(product);
    const productTaxSummary = calculateTaxSummary([product], resolvedGstMode);
    const productTaxEntry = Array.from(productTaxSummary.values())[0];
    const taxAmount = productTaxEntry
      ? roundTo2(productTaxEntry.cgstAmount + productTaxEntry.sgstAmount)
      : 0;

    const row: (string | number)[] = [];
    for (const col of columns) {
      switch (col.key) {
        case 'srNo': row.push(i + 1); break;
        case 'name': {
          let nameStr = product.name;
          if (isColumnVisible('description', documentType, quotation, invoice, settings, schema) && product.description?.trim()) {
            nameStr += '\n' + product.description;
          }
          row.push(nameStr);
          break;
        }
        case 'hsnSacCode': row.push(product.hsnSacCode || '—'); break;
        case 'wattage': row.push(product.wattage ? `${product.wattage}W` : '—'); break;
        case 'partNumber': row.push(product.partNumber || '—'); break;
        case 'vehicleModel': row.push(product.vehicleModel || '—'); break;
        case 'mrp': row.push(product.mrp ? `Rs. ${product.mrp.toLocaleString('en-IN')}` : '—'); break;
        case 'batchNumber': row.push(product.batchNumber || '—'); break;
        case 'expiryDate': row.push(product.expiryDate || '—'); break;
        case 'warrantyMonths': row.push(product.warrantyMonths ? `${product.warrantyMonths} mo` : '—'); break;
        case 'quantityUnit': {
          const unitLabel = UNIT_OPTIONS.find(u => u.value === product.unit)?.label || 'Piece';
          row.push(`${product.quantity} ${unitLabel}`);
          break;
        }
        case 'rate': row.push(fmtInt(product.unitPrice)); break;
        case 'discount': row.push(`${product.discount ?? 0}%`); break;
        case 'tax': row.push(`${fmtInt(taxAmount)}\n(${product.gstPercent}%)`); break;
        case 'amount': row.push(fmtInt(amount)); break;
        default: row.push(''); break;
      }
    }
    return row;
  });

  if (products.length === 0) {
    const emptyRow: (string | number)[] = new Array(columns.length).fill('');
    emptyRow[0] = 'No items added';
    body.push(emptyRow);
  }

  // Column styles
  const columnStyles: Record<number, { cellWidth: number | 'auto'; halign: 'left' | 'center' | 'right' }> = {};
  columns.forEach((col, idx) => {
    columnStyles[idx] = {
      cellWidth: col.width > 0 ? col.width : 'auto',
      halign: col.align,
    };
  });

  // Draw product table with autoTable
  autoTable(doc, {
    startY: y,
    head: head,
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: tableHeaderBg,
      textColor: hexToRgb(settings.tableHeaderTextColor ?? style.tableHeaderTextColor),
      fontStyle: 'bold',
      fontSize: tableHeaderTypo.fontSizePt,
      halign: 'center',
      cellPadding: [cellPadY, cellPadX] as any,
      lineColor: tableBorderColor,
      lineWidth: 0.1,
    },
    bodyStyles: {
      fontSize: productRowTypo.fontSizePt,
      textColor: [0, 0, 0],
      lineColor: tableBorderColor,
      lineWidth: 0.1,
      cellPadding: [cellPadY, cellPadX] as any,
    },
    alternateRowStyles: {
      fillColor: hexToRgb(style.tableRowAltBg),
    },
    columnStyles: columnStyles as any,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    tableWidth: contentWidth,
    tableLineColor: tableBorderColor,
    tableLineWidth: 0.1,
  });

  // Safely get finalY (avoid undefined finalY error)
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  y = finalY;

  drawSecBorder(y);
  y += pxToMm(1);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 5: Tax Summary + Grand Total
  // ═══════════════════════════════════════════════════════════════════════

  ensureSpace(30);
  const totalsPadTop = pxToMm(10) * fontScale;
  const totalsPadSide = pxToMm(16) * fontScale;
  const totalsStartY = y + totalsPadTop;

  // Typography
  const taxSummaryLabelTypo = getTypo('tax_summary_label', settings, fontScale);
  const taxSummaryRowTypo = getTypo('tax_summary_row', settings, fontScale);
  const subtotalLabelTypo = getTypo('subtotal_label', settings, fontScale);
  const subtotalValueTypo = getTypo('subtotal_value', settings, fontScale);
  const cgstLabelTypo = getTypo('cgst_label', settings, fontScale);
  const cgstValueTypo = getTypo('cgst_value', settings, fontScale);
  const sgstLabelTypo = getTypo('sgst_label', settings, fontScale);
  const sgstValueTypo = getTypo('sgst_value', settings, fontScale);
  const roundOffLabelTypo = getTypo('round_off_label', settings, fontScale);
  const roundOffValueTypo = getTypo('round_off_value', settings, fontScale);
  const grandTotalLabelTypo = getTypo('grand_total_label', settings, fontScale);
  const grandTotalValueTypo = getTypo('grand_total_value', settings, fontScale);
  const amountInWordsTypo = getTypo('amount_in_words', settings, fontScale);

  // Grand total column width: 220px in preview when tax summary is shown.
  // totalsX = left edge of the grand-total div (mirrors flex layout: tax summary
  // gets flex:1, grand total gets fixed width 220px). Text inside has 16px padding.
  const totalsColWidth = showTaxSummary ? pxToMm(220) * fontScale : contentWidth - totalsPadSide * 2;
  const totalsX = paperWidth - margin - totalsColWidth;
  const totalsLabelX = totalsX + totalsPadSide;
  const totalsValueX = paperWidth - margin - totalsPadSide;

  // Tax summary on left AND grand total on right — both start at totalsStartY
  let taxSummaryFinalY = totalsStartY;
  let grandTotalFinalY = totalsStartY;

  // ── Tax Summary (left side) ──────────────────────────────────────────
  if (showTaxSummary) {
    // Tax summary content area: from (margin + padSide) to (totalsX - border - padSide)
    const taxTableLeft = margin + totalsPadSide;
    const taxTableRight = totalsX - pxToMm(1) * fontScale - totalsPadSide;
    const taxSummaryWidth = taxTableRight - taxTableLeft;

    setFont(taxSummaryLabelTypo);
    doc.setTextColor(...primaryColor);
    doc.text('Tax Summary', taxTableLeft, totalsStartY + lineHeightMm(taxSummaryLabelTypo.fontSizePt) * 0.8);

    const taxHead = [['HSN/SAC', 'Tax%', 'Taxable Amt', 'CGST', 'SGST']];
    const taxBody = Array.from(taxSummary.entries()).map(([key, data]) => {
      const rate = key.split('_')[1];
      return [
        data.hsnSacCode || '—',
        `${rate}%`,
        fmt(data.taxableAmount),
        fmt(data.cgstAmount),
        fmt(data.sgstAmount),
      ];
    });

    const taxCellPadY = pxToMm(3) * fontScale;
    const taxCellPadX = pxToMm(5) * fontScale;

    autoTable(doc, {
      startY: totalsStartY + lineHeightMm(taxSummaryLabelTypo.fontSizePt) + pxToMm(5) * fontScale,
      head: taxHead,
      body: taxBody,
      theme: 'grid',
      headStyles: {
        fillColor: tableHeaderBg,
        textColor: hexToRgb(settings.tableHeaderTextColor ?? style.tableHeaderTextColor),
        fontStyle: 'bold',
        fontSize: taxSummaryRowTypo.fontSizePt * 0.8,
        cellPadding: [taxCellPadY, taxCellPadX] as any,
        lineColor: tableBorderColor,
        lineWidth: 0.1,
      },
      bodyStyles: {
        fontSize: taxSummaryRowTypo.fontSizePt * 0.8,
        textColor: [0, 0, 0],
        cellPadding: [taxCellPadY, taxCellPadX] as any,
        lineColor: tableBorderColor,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      } as any,
      margin: { left: taxTableLeft, right: paperWidth - taxTableRight, top: margin, bottom: margin },
      tableWidth: taxSummaryWidth,
    });

    taxSummaryFinalY = (doc as any).lastAutoTable?.finalY ?? totalsStartY + 20;
  }

  // ── Grand Total (right side) — starts at SAME Y as tax summary ───────
  let gtY = totalsStartY;

  const drawTotalLine = (label: string, value: string, labelTypo: TypoVal, valueTypo: TypoVal) => {
    ensureSpace(lineHeightMm(labelTypo.fontSizePt) + 2);
    setFont(labelTypo);
    doc.setTextColor(0, 0, 0);
    doc.text(label, totalsLabelX, gtY + lineHeightMm(labelTypo.fontSizePt) * 0.8);
    setFont(valueTypo);
    doc.text(value, totalsValueX, gtY + lineHeightMm(valueTypo.fontSizePt) * 0.8, { align: 'right' });
    gtY += lineHeightMm(labelTypo.fontSizePt) + pxToMm(3) * fontScale;
  };

  drawTotalLine('Sub Total', `Rs. ${fmt(totalTaxable)}`, subtotalLabelTypo, subtotalValueTypo);

  if (showGstDetails) {
    drawTotalLine('CGST', `Rs. ${fmt(totalCgst)}`, cgstLabelTypo, cgstValueTypo);
    drawTotalLine('SGST', `Rs. ${fmt(totalSgst)}`, sgstLabelTypo, sgstValueTypo);
  }

  if (roundOff !== 0) {
    drawTotalLine('Round Off', `Rs. ${fmt(roundOff)}`, roundOffLabelTypo, roundOffValueTypo);
  }

  // Grand total line with top border
  ensureSpace(10);
  doc.setDrawColor(...secBorderColor);
  doc.setLineWidth(0.4);
  gtY += pxToMm(5) * fontScale;
  doc.line(totalsLabelX, gtY, totalsValueX, gtY);
  gtY += pxToMm(5) * fontScale;

  const totalSectionColorRgb = hexToRgb(settings.totalSectionColor ?? '#000000');
  setFont(grandTotalLabelTypo);
  doc.setTextColor(...totalSectionColorRgb);
  doc.text('Total', totalsLabelX, gtY + lineHeightMm(grandTotalLabelTypo.fontSizePt) * 0.8);
  setFont(grandTotalValueTypo);
  doc.text(`Rs. ${fmt(roundedGrandTotal)}`, totalsValueX, gtY + lineHeightMm(grandTotalValueTypo.fontSizePt) * 0.8, { align: 'right' });
  gtY += lineHeightMm(grandTotalLabelTypo.fontSizePt) + pxToMm(4) * fontScale;

  // Amount in words
  setFont(amountInWordsTypo, true);
  doc.setTextColor(0, 0, 0);
  const wordsText = numberToWords(roundedGrandTotal);
  const wordsLines = doc.splitTextToSize(wordsText, totalsColWidth - totalsPadSide * 2);
  doc.text(wordsLines, totalsLabelX, gtY + lineHeightMm(amountInWordsTypo.fontSizePt) * 0.8);
  gtY += wordsLines.length * lineHeightMm(amountInWordsTypo.fontSizePt) + pxToMm(2) * fontScale;

  grandTotalFinalY = gtY;

  // Vertical divider between Tax Summary and Grand Total (matches preview borderRight)
  if (showTaxSummary) {
    const dividerTop = totalsStartY - totalsPadTop;
    const dividerBottom = Math.max(taxSummaryFinalY, grandTotalFinalY) + totalsPadTop;
    doc.setDrawColor(...secBorderColor);
    doc.setLineWidth(0.2);
    doc.line(totalsX, dividerTop, totalsX, dividerBottom);
  }

  // Y advances to the bottom of whichever section is taller
  y = Math.max(taxSummaryFinalY, grandTotalFinalY) + totalsPadTop;
  drawSecBorder(y);
  y += pxToMm(1);

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 6: Notes
  // ═══════════════════════════════════════════════════════════════════════

  if (settings.showNotes) {
    ensureSpace(8);
    y += pxToMm(8) * fontScale;
    const notesLabelTypo = getTypo('notes_label', settings, fontScale);
    const notesValueTypo = getTypo('notes_value', settings, fontScale);

    setFont(notesLabelTypo);
    doc.setTextColor(...primaryColor);
    doc.text('Notes: ', margin + pxToMm(16) * fontScale, y + lineHeightMm(notesLabelTypo.fontSizePt) * 0.8);

    setFont(notesValueTypo);
    doc.setTextColor(0, 0, 0);
    const notesText = quotation.notes || 'Thank you for your business!';

    setFont(notesLabelTypo);
    const labelWidth = doc.getTextWidth('Notes: ');
    setFont(notesValueTypo);
    const notesLines = doc.splitTextToSize(notesText, contentWidth - pxToMm(16) * fontScale * 2 - labelWidth);
    doc.text(notesLines, margin + pxToMm(16) * fontScale + labelWidth, y + lineHeightMm(notesValueTypo.fontSizePt) * 0.8);
    y += Math.max(notesLines.length * lineHeightMm(notesValueTypo.fontSizePt), lineHeightMm(notesLabelTypo.fontSizePt)) + pxToMm(8) * fontScale;

    drawSecBorder(y);
    y += pxToMm(1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 7: Bank Details + QR + Signature
  // ═══════════════════════════════════════════════════════════════════════

  const hasFooter = settings.showBankDetails || settings.showPaymentQr || settings.showSignature;
  if (hasFooter) {
    ensureSpace(30);
    const footerPadTop = pxToMm(10) * fontScale;
    const footerPadSide = pxToMm(16) * fontScale;
    y += footerPadTop;
    const footerStartY = y;

    const showBank = settings.showBankDetails;
    const showQr = settings.showPaymentQr;
    const showSig = settings.showSignature;

    // Calculate section widths (flex: 1 each in preview)
    const sections = [showBank, showQr, showSig].filter(Boolean).length;
    const footerSectionWidth = contentWidth / sections;

    // ── Bank Details ──────────────────────────────────────────────────────
    if (showBank) {
      const bankX = margin + footerPadSide;
      const bankLabelTypo = getTypo('bank_details_label', settings, fontScale);
      const bankContentTypo = getTypo('bank_details_content', settings, fontScale);

      setFont(bankLabelTypo);
      doc.setTextColor(...primaryColor);
      doc.text('Bank Details', bankX, footerStartY + lineHeightMm(bankLabelTypo.fontSizePt) * 0.8);

      let bankY = footerStartY + lineHeightMm(bankLabelTypo.fontSizePt) + pxToMm(4) * fontScale;
      if (company.bankName) {
        setFont(bankContentTypo);
        doc.setTextColor(0, 0, 0);
        doc.text(`Bank: ${company.bankName}`, bankX, bankY + lineHeightMm(bankContentTypo.fontSizePt) * 0.8);
        bankY += lineHeightMm(bankContentTypo.fontSizePt) + pxToMm(2) * fontScale;
      }
      if (company.bankAccount) {
        setFont(bankContentTypo);
        doc.text(`A/c: ${company.bankAccount}`, bankX, bankY + lineHeightMm(bankContentTypo.fontSizePt) * 0.8);
        bankY += lineHeightMm(bankContentTypo.fontSizePt) + pxToMm(2) * fontScale;
      }
      if (company.bankIfsc) {
        setFont(bankContentTypo);
        doc.text(`IFSC: ${company.bankIfsc}`, bankX, bankY + lineHeightMm(bankContentTypo.fontSizePt) * 0.8);
        bankY += lineHeightMm(bankContentTypo.fontSizePt) + pxToMm(2) * fontScale;
      }
      if (company.bankBranch) {
        setFont(bankContentTypo);
        doc.text(`Branch: ${company.bankBranch}`, bankX, bankY + lineHeightMm(bankContentTypo.fontSizePt) * 0.8);
        bankY += lineHeightMm(bankContentTypo.fontSizePt) + pxToMm(2) * fontScale;
      }

      y = Math.max(y, bankY);
    }

    // ── QR Code ───────────────────────────────────────────────────────────
    if (showQr) {
      const qrX = margin + footerSectionWidth + footerPadSide;
      const qrSize = pxToMm(64) * fontScale;

      if (quotation.paymentQr) {
        try {
          const isJpeg = quotation.paymentQr.startsWith('data:image/jpeg') || quotation.paymentQr.startsWith('data:image/jpg');
          doc.addImage(quotation.paymentQr, isJpeg ? 'JPEG' : 'PNG', qrX, footerStartY, qrSize, qrSize, undefined, 'FAST');
        } catch {
          doc.setDrawColor(...primaryColor);
          doc.setLineWidth(0.3);
          doc.rect(qrX, footerStartY, qrSize, qrSize, 'S');
          const qrLabelTypo = getTypo('custom_block', settings, fontScale);
          setFont(qrLabelTypo);
          doc.text('QR Code', qrX + qrSize / 2, footerStartY + qrSize / 2, { align: 'center' });
        }
      } else {
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.3);
        doc.rect(qrX, footerStartY, qrSize, qrSize, 'S');
        const qrLabelTypo = getTypo('custom_block', settings, fontScale);
        setFont(qrLabelTypo);
        doc.text('QR Code', qrX + qrSize / 2, footerStartY + qrSize / 2, { align: 'center' });
      }

      const qrCaptionTypo = getTypo('custom_block', settings, fontScale);
      setFont(qrCaptionTypo);
      doc.setTextColor(0, 0, 0);
      doc.text('Scan to Pay', qrX + qrSize / 2, footerStartY + qrSize + pxToMm(3) * fontScale + lineHeightMm(qrCaptionTypo.fontSizePt) * 0.8, { align: 'center' });

      y = Math.max(y, footerStartY + qrSize + pxToMm(3) * fontScale + lineHeightMm(qrCaptionTypo.fontSizePt));
    }

    // ── Signature ─────────────────────────────────────────────────────────
    if (showSig) {
      const sigSectionIndex = (showBank ? 1 : 0) + (showQr ? 1 : 0);
      const sigX = margin + footerSectionWidth * sigSectionIndex + footerPadSide;
      const sigWidth = footerSectionWidth - footerPadSide * 2;
      const sigImgHeight = pxToMm(45) * fontScale;

      const signatureImg = quotation.signature || company.signature;

      if (signatureImg) {
        try {
          const isJpeg = signatureImg.startsWith('data:image/jpeg') || signatureImg.startsWith('data:image/jpg');
          doc.addImage(signatureImg, isJpeg ? 'JPEG' : 'PNG', sigX, footerStartY, sigWidth * 0.6, sigImgHeight, undefined, 'FAST');
        } catch {
          // Skip
        }
      }

      // Signature line
      const sigLineY = footerStartY + sigImgHeight + pxToMm(4) * fontScale;
      doc.setDrawColor(...secBorderColor);
      doc.setLineWidth(0.2);
      doc.line(sigX, sigLineY, sigX + sigWidth, sigLineY);

      const sigLabelTypo = getTypo('signature_label', settings, fontScale);
      setFont(sigLabelTypo);
      doc.setTextColor(0, 0, 0);
      doc.text('Authorised Signatory', sigX + sigWidth / 2, sigLineY + pxToMm(4) * fontScale + lineHeightMm(sigLabelTypo.fontSizePt) * 0.8, { align: 'center' });

      y = Math.max(y, sigLineY + pxToMm(4) * fontScale + lineHeightMm(sigLabelTypo.fontSizePt));
    }

    // Draw vertical dividers between footer sections
    if (sections > 1) {
      doc.setDrawColor(...secBorderColor);
      doc.setLineWidth(0.2);
      const sectionEndY = y;
      if (showBank && (showQr || showSig)) {
        doc.line(margin + footerSectionWidth, footerStartY - footerPadTop, margin + footerSectionWidth, sectionEndY);
      }
      if (showQr && showSig) {
        doc.line(margin + footerSectionWidth * 2, footerStartY - footerPadTop, margin + footerSectionWidth * 2, sectionEndY);
      }
    }

    y += footerPadTop;
    drawSecBorder(y);
    y += pxToMm(1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION 8: Terms & Conditions
  // ═══════════════════════════════════════════════════════════════════════

  if (settings.showTermsConditions) {
    const termsLabelTypo = getTypo('terms_label', settings, fontScale);
    const termsContentTypo = getTypo('terms_content', settings, fontScale);

    const termsText = quotation.terms ||
      '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.';

    const termsLines = termsText.split('\n');
    const termsHeight = termsLines.length * lineHeightMm(termsContentTypo.fontSizePt) + lineHeightMm(termsLabelTypo.fontSizePt) + pxToMm(16) * fontScale;
    ensureSpace(termsHeight);

    y += pxToMm(8) * fontScale;
    setFont(termsLabelTypo);
    doc.setTextColor(...primaryColor);
    doc.text('Terms & Conditions', margin + pxToMm(16) * fontScale, y + lineHeightMm(termsLabelTypo.fontSizePt) * 0.8);
    y += lineHeightMm(termsLabelTypo.fontSizePt) + pxToMm(3) * fontScale;

    setFont(termsContentTypo);
    doc.setTextColor(0, 0, 0);
    for (const line of termsLines) {
      const wrappedLines = doc.splitTextToSize(line, contentWidth - pxToMm(16) * fontScale * 2);
      doc.text(wrappedLines, margin + pxToMm(16) * fontScale, y + lineHeightMm(termsContentTypo.fontSizePt) * 0.8);
      y += wrappedLines.length * lineHeightMm(termsContentTypo.fontSizePt);
    }

    y += pxToMm(8) * fontScale;
    drawSecBorder(y);
    y += pxToMm(1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Footer Strip
  // ═══════════════════════════════════════════════════════════════════════

  ensureSpace(6);
  const footerStripTypo = getTypo('footer_strip', settings, fontScale);
  const footerStripPadTop = pxToMm(5) * fontScale;

  // Top border for footer strip
  doc.setDrawColor(...secBorderColor);
  doc.setLineWidth(0.2);
  doc.line(margin, y, paperWidth - margin, y);

  y += footerStripPadTop;
  setFont(footerStripTypo);
  doc.setTextColor(170, 170, 170);
  doc.text('Computer-generated document. No signature required.', paperWidth / 2, y + lineHeightMm(footerStripTypo.fontSizePt) * 0.8, { align: 'center' });
  y += lineHeightMm(footerStripTypo.fontSizePt) + footerStripPadTop;

  // ── Draw outer border (if theme has it) on all pages ────────────────────
  if (theme.outerBorder) {
    const totalPages = doc.getNumberOfPages();
    const borderWidth = theme.outerBorderWidth * 0.3;
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(borderWidth);
      doc.rect(margin - 1, margin - 1, contentWidth + 2, pageHeight - margin * 2 + 2);
    }
  }

  return y;
};
