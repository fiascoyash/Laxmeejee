import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, Invoice, GstMode, ThemeId, DEFAULT_TEMPLATE_SETTINGS, TemplateSchema, UNIT_OPTIONS, INVOICE_THEMES } from '../types';
import { calculateProductAmount, calculateTaxSummary, calculateRoundOff, numberToWords, roundTo2, calculateGrandTotalAmount } from './storage';

export type DocumentType = 'quotation' | 'invoice';

/**
 * Main PDF export function - Direct jsPDF generation (no html2canvas)
 * Generates lightweight PDFs (~100-300KB instead of 9-12MB)
 */
export const exportTemplatePDF = async (
  template: QuotationTemplate,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType = 'quotation',
  invoice?: Invoice,
  gstMode: GstMode = 'inclusive'
) => {
  const themeId = (template as any).themeId as ThemeId | undefined;
  const settings = template.settings ?? DEFAULT_TEMPLATE_SETTINGS;
  const schema = template.schema;

  // Use direct PDF generation for all templates
  await exportDirectPDF(themeId || 'billbook', settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
};

/**
 * Compress image to JPEG format with reduced quality for smaller PDF size
 */
const compressImage = (dataUrl: string, maxSize: number = 150): string => {
  if (!dataUrl) return '';

  // If already small or not a data URL, return as-is
  if (!dataUrl.startsWith('data:image')) return dataUrl;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.src = dataUrl;

    // Calculate scaled dimensions
    let width = img.width;
    let height = img.height;

    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else {
        width = (width / height) * maxSize;
        height = maxSize;
      }
    }

    canvas.width = width;
    canvas.height = height;

    ctx?.drawImage(img, 0, 0, width, height);

    // Return as JPEG with 70% quality
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return dataUrl;
  }
};

/**
 * Load image and return dimensions
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Direct PDF generation using jsPDF + autotable - No html2canvas
 * Produces lightweight PDFs while maintaining professional appearance
 */
const exportDirectPDF = async (
  themeId: ThemeId,
  settings: typeof DEFAULT_TEMPLATE_SETTINGS,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType,
  invoice?: Invoice,
  gstMode: GstMode = 'inclusive',
  schema?: TemplateSchema
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const theme = INVOICE_THEMES[themeId] || INVOICE_THEMES.billbook;
  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 10;

  // Colors from theme
  const primaryColor = theme.primaryColor;

  // Tax calculations
  const taxSummary = calculateTaxSummary(products, gstMode);
  const totalTaxable = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
  const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
  const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
  const grandTotalRaw = calculateGrandTotalAmount(products, gstMode);
  const { roundOff: roundOffVal, roundedGrandTotal } = calculateRoundOff(grandTotalRaw);

  const docLabel = documentType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber = documentType === 'invoice' ? invoice?.invoiceNumber ?? '' : quotation.quotationNumber;
  const docDate = documentType === 'invoice' ? invoice?.date ?? quotation.date : quotation.date;
  const dueDate = documentType === 'invoice' ? invoice?.dueDate : undefined;

  // Helper function to check column visibility
  const isColumnVisible = (key: string): boolean => {
    if (schema?.productColumns && schema.productColumns.length > 0) {
      const schemaCol = schema.productColumns.find(c => c.key === key);
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
    return settingsMap[key] ?? false;
  };

  // ─── SECTION 1: Header ──────────────────────────────────────────────
  const headerAlign = settings.headerAlignment ?? 'left';

  // Set header background
  doc.setFillColor(theme.headerBg === '#1e3a5f' ? '#1e3a5f' : '#FFFFFF');
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Accent bar for certain themes
  if (theme.accentBar) {
    doc.setFillColor(primaryColor);
    doc.rect(margin, 32, contentWidth, 1.5, 'F');
  }

  // Company Logo
  let logoWidth = 0;
  if (company.logo) {
    try {
      const compressedLogo = compressImage(company.logo, 100);
      const img = await loadImage(compressedLogo);
      const aspectRatio = img.width / img.height;
      const logoHeight = 15;
      logoWidth = logoHeight * aspectRatio;
      doc.addImage(compressedLogo, 'JPEG', margin, yPos, Math.min(logoWidth, 30), logoHeight, undefined, 'FAST');
    } catch { /* Skip logo on error */ }
  }

  // Company Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(theme.headerTextColor || '#000000');
  const companyNameX = logoWidth > 0 ? margin + logoWidth + 5 : margin;
  doc.text(company.companyName || 'Company Name', companyNameX, yPos + 8);

  // Company Address
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(theme.headerTextColor || '#000000');
  if (company.address) {
    const addressLines = doc.splitTextToSize(company.address, 60);
    doc.text(addressLines, companyNameX, yPos + 13);
    yPos += addressLines.length * 3;
  }

  // GSTIN
  if (settings.showGstin && company.gstNumber) {
    doc.setFontSize(8);
    doc.text(`GSTIN: ${company.gstNumber}`, companyNameX, yPos + 17);
  }

  // Phone & Email
  if (settings.showPhone && company.phone) {
    doc.setFontSize(8);
    doc.text(`Ph: ${company.phone}${company.email ? ` | ${company.email}` : ''}`, companyNameX, yPos + 21);
  }

  // Document Title (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(primaryColor);
  doc.text(docLabel, pageWidth - margin, yPos + 8, { align: 'right' });

  // Document Number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#000000');
  doc.text(`No: ${docNumber}`, pageWidth - margin, yPos + 14, { align: 'right' });
  doc.text(`Date: ${docDate}`, pageWidth - margin, yPos + 19, { align: 'right' });

  if (dueDate && settings.showDueDate) {
    doc.text(`Due: ${dueDate}`, pageWidth - margin, yPos + 24, { align: 'right' });
  }

  yPos = 40;

  // ─── SECTION 2: Bill To / Ship To ──────────────────────────────────────────────
  const hasShipTo = settings.showShippingAddress && !!(quotation.shipTo?.name?.trim() || quotation.shipTo?.address?.trim());
  const partyWidth = hasShipTo ? contentWidth / 2 : contentWidth;

  // Bill To
  doc.setFillColor('#F8FAFC');
  doc.rect(margin, yPos, partyWidth, 25, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor);
  doc.text('Bill To', margin + 3, yPos + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#000000');
  doc.text(customer.name || '', margin + 3, yPos + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (settings.showBillingAddress && customer.billingAddress) {
    const billAddrLines = doc.splitTextToSize(customer.billingAddress, partyWidth - 10);
    doc.text(billAddrLines, margin + 3, yPos + 14);
  }
  const location = [customer.village, customer.district].filter(Boolean).join(', ');
  if (location) {
    doc.text(location, margin + 3, yPos + 18);
  }
  if (settings.showPhone && customer.mobile) {
    doc.text(`Mobile: ${customer.mobile}`, margin + 3, yPos + 22);
  }

  // Ship To (if applicable)
  if (hasShipTo) {
    const shipX = margin + partyWidth + 3;
    doc.setDrawColor(theme.sectionBorderColor || '#E2E8F0');
    doc.line(margin + partyWidth, yPos, margin + partyWidth, yPos + 25);

    doc.setFillColor('#FFFFFF');
    doc.rect(shipX, yPos, partyWidth - 3, 25, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor);
    doc.text('Ship To', shipX + 3, yPos + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#000000');
    if (quotation.shipTo?.name) {
      doc.text(quotation.shipTo.name, shipX + 3, yPos + 10);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (quotation.shipTo?.address) {
      const shipAddrLines = doc.splitTextToSize(quotation.shipTo.address, partyWidth - 10);
      doc.text(shipAddrLines, shipX + 3, yPos + 14);
    }
    if (quotation.shipTo?.mobile && settings.showPhone) {
      doc.text(`Mobile: ${quotation.shipTo.mobile}`, shipX + 3, yPos + 18);
    }
  }

  yPos += 30;

  // ─── SECTION 3: Product Table ──────────────────────────────────────────────
  const visibleColumns: { key: string; label: string; width: number; align: 'left' | 'center' | 'right' }[] = [];

  visibleColumns.push({ key: 'sno', label: 'No', width: 10, align: 'center' });
  visibleColumns.push({ key: 'name', label: 'Items', width: 50, align: 'left' });

  if (isColumnVisible('hsnSacCode')) visibleColumns.push({ key: 'hsnSacCode', label: 'HSN/SAC', width: 20, align: 'right' });
  if (isColumnVisible('quantityUnit')) visibleColumns.push({ key: 'quantityUnit', label: 'Qty/Unit', width: 20, align: 'right' });
  visibleColumns.push({ key: 'unitPrice', label: 'Rate', width: 22, align: 'right' });
  if (isColumnVisible('discount')) visibleColumns.push({ key: 'discount', label: 'Disc%', width: 15, align: 'right' });
  if (isColumnVisible('gstPercent')) visibleColumns.push({ key: 'gstPercent', label: 'Tax', width: 18, align: 'right' });
  visibleColumns.push({ key: 'amount', label: 'Total', width: 22, align: 'right' });

  const tableData = products.map((p, i) => {
    const row: (string | number)[] = [];
    visibleColumns.forEach(col => {
      switch (col.key) {
        case 'sno': row.push(i + 1); break;
        case 'name': row.push(p.name); break;
        case 'hsnSacCode': row.push(p.hsnSacCode || '-'); break;
        case 'quantityUnit':
          const unitLabel = UNIT_OPTIONS.find(u => u.value === p.unit)?.label || 'Piece';
          row.push(`${p.quantity} ${unitLabel}`);
          break;
        case 'unitPrice': row.push(p.unitPrice.toLocaleString('en-IN')); break;
        case 'discount': row.push(`${p.discount ?? 0}%`); break;
        case 'gstPercent': row.push(`${p.gstPercent}%`); break;
        case 'amount': row.push(calculateProductAmount(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })); break;
        default: row.push('');
      }
    });
    return row;
  });

  const columnStyles: Record<number, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};
  visibleColumns.forEach((col, i) => {
    columnStyles[i] = { cellWidth: col.width, halign: col.align };
  });

  autoTable(doc, {
    startY: yPos,
    head: [visibleColumns.map(c => c.label)],
    body: tableData,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: theme.tableHeaderBg === '#F1F5F9' ? [241, 245, 249] : [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: [200, 200, 200],
    },
    bodyStyles: {
      fontSize: 8,
      lineColor: [220, 220, 220],
    },
    alternateRowStyles: {
      fillColor: theme.tableRowAltBg === '#F8FAFC' ? [248, 250, 252] : [255, 255, 255],
    },
    columnStyles,
    tableWidth: contentWidth,
  });

  // Get the final Y position after table
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 5 : yPos + 50;

  // ─── SECTION 4: Tax Summary + Totals ──────────────────────────────────────────────
  const showTaxSummary = settings.showTaxSummary !== false;

  if (showTaxSummary) {
    // Tax Summary on left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor);
    doc.text('Tax Summary', margin, finalY);

    const taxHead = ['HSN/SAC', 'Tax%', 'Taxable', 'CGST', 'SGST'];
    const taxBody = Array.from(taxSummary.entries()).map(([key, data]) => {
      const [hsn] = key.split('_');
      return [hsn, `${data.cgstRate}%`, fmt(data.taxableAmount), fmt(data.cgstAmount), fmt(data.sgstAmount)];
    });

    autoTable(doc, {
      startY: finalY + 3,
      head: [taxHead],
      body: taxBody,
      theme: 'plain',
      margin: { left: margin },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [100, 100, 100],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'left' },
        1: { cellWidth: 15, halign: 'right' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 20, halign: 'right' },
      },
      tableWidth: 105,
    });
  }

  // Grand Total on right
  const totalsX = pageWidth - margin - 55;
  let totalsY = finalY;

  doc.setFontSize(8);
  doc.setTextColor('#000000');

  doc.setFont('helvetica', 'normal');
  doc.text('Taxable:', totalsX, totalsY, { align: 'left' });
  doc.text(fmt(totalTaxable), pageWidth - margin, totalsY, { align: 'right' });
  totalsY += 5;

  doc.text('CGST:', totalsX, totalsY, { align: 'left' });
  doc.text(fmt(totalCgst), pageWidth - margin, totalsY, { align: 'right' });
  totalsY += 5;

  doc.text('SGST:', totalsX, totalsY, { align: 'left' });
  doc.text(fmt(totalSgst), pageWidth - margin, totalsY, { align: 'right' });
  totalsY += 5;

  if (roundOffVal !== 0) {
    doc.text('Round Off:', totalsX, totalsY, { align: 'left' });
    doc.text(fmt(roundOffVal), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += 5;
  }

  // Grand Total line
  doc.setDrawColor(primaryColor);
  doc.line(totalsX, totalsY - 1, pageWidth - margin, totalsY - 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(primaryColor);
  doc.text('Total:', totalsX, totalsY + 5, { align: 'left' });
  doc.text(fmt(roundedGrandTotal), pageWidth - margin, totalsY + 5, { align: 'right' });

  // Amount in words
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor('#666666');
  doc.text(`(${numberToWords(roundedGrandTotal)})`, pageWidth - margin, totalsY + 10, { align: 'right' });

  // Update position after totals
  const afterTotalsY = Math.max(
    showTaxSummary && (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 5 : totalsY,
    totalsY + 15
  );

  // ─── SECTION 5: Bank Details + Signature ──────────────────────────────────────────────
  let footerY = afterTotalsY + 10;
  const hasBank = settings.showBankDetails && (company.bankName || company.bankAccount);
  const hasSignature = settings.showSignature && company.signature;

  if (hasBank || hasSignature) {
    // Bank Details (left side)
    if (hasBank) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor);
      doc.text('Bank Details', margin, footerY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor('#000000');

      if (company.bankName) doc.text(`Bank: ${company.bankName}`, margin, footerY + 5);
      if (company.bankAccount) doc.text(`A/c: ${company.bankAccount}`, margin, footerY + 10);
      if (company.bankIfsc) doc.text(`IFSC: ${company.bankIfsc}`, margin, footerY + 15);
    }

    // Signature (right side)
    if (hasSignature) {
      try {
        const compressedSig = compressImage(company.signature, 80);
        doc.addImage(compressedSig, 'JPEG', pageWidth - margin - 40, footerY, 35, 15, undefined, 'FAST');
      } catch { /* Skip signature on error */ }

      doc.setDrawColor(180, 180, 180);
      doc.line(pageWidth - margin - 40, footerY + 18, pageWidth - margin - 5, footerY + 18);
      doc.setFontSize(7);
      doc.text('Authorised Signatory', pageWidth - margin - 22, footerY + 23, { align: 'center' });
    }
  }

  // ─── SECTION 6: Terms & Conditions / Notes ──────────────────────────────────────────────
  footerY += 30;

  if (settings.showNotes && quotation.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(primaryColor);
    doc.text('Notes:', margin, footerY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#000000');
    const notesLines = doc.splitTextToSize(quotation.notes, contentWidth - 10);
    doc.text(notesLines, margin + 12, footerY);
  }

  // ─── FOOTER ──────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor('#888888');
  doc.text('Thank you for your business!', pageWidth / 2, 285, { align: 'center' });

  // Save with compression
  const fileName = documentType === 'invoice' && invoice ? invoice.invoiceNumber : quotation.quotationNumber;
  doc.save(`${fileName}.pdf`, { returnPromise: true });
};

/**
 * Format number for display
 */
const fmt = (n: number): string => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
