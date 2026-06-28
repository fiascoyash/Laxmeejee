import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, TemplateBlock, TableColumn, Invoice, GstMode, ThemeId, DEFAULT_TEMPLATE_SETTINGS, INVOICE_THEMES } from '../types';
import { calculateProductAmount, calculateTaxSummary, calculateRoundOff, numberToWords, roundTo2, calculateGrandTotalAmount } from './storage';
import { resolvePlaceholders } from './placeholders';

export type DocumentType = 'quotation' | 'invoice';

/**
 * Main PDF export function.
 * For new flow-based templates (has themeId), uses WYSIWYG HTML-to-canvas capture.
 * For legacy block-based templates, uses the old rendering logic.
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

  // Use new WYSIWYG export for theme-based templates
  if (themeId) {
    await exportFlowBasedPDF(themeId, settings, company, customer, quotation, products, documentType, invoice, gstMode);
    return;
  }

  // Legacy block-based export
  exportBlockBasedPDF(template, company, customer, quotation, products, documentType, invoice, gstMode);
};

/**
 * WYSIWYG PDF export for flow-based templates.
 * Renders the DocumentRenderer to DOM, captures with html2canvas, adds to PDF.
 */
const exportFlowBasedPDF = async (
  themeId: ThemeId,
  settings: typeof DEFAULT_TEMPLATE_SETTINGS,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType,
  invoice?: Invoice,
  gstMode: GstMode = 'inclusive'
) => {
  // Create a temporary container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.backgroundColor = '#FFFFFF';
  document.body.appendChild(container);

  // Render the document content
  const theme = INVOICE_THEMES[themeId] ?? INVOICE_THEMES.simple;
  const taxSummary = calculateTaxSummary(products, gstMode);
  const totalTaxable = roundTo2(Array.from(taxSummary.values()).reduce((s, t) => s + t.taxableAmount, 0));
  const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((s, t) => s + t.cgstAmount, 0));
  const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((s, t) => s + t.sgstAmount, 0));
  const grandTotalRaw = calculateGrandTotalAmount(products, gstMode);
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalRaw);

  const docLabel = documentType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber = documentType === 'invoice' ? invoice?.invoiceNumber ?? '' : quotation.quotationNumber;
  const docDate = documentType === 'invoice' ? invoice?.date ?? quotation.date : quotation.date;
  const dueDate = documentType === 'invoice' ? invoice?.dueDate : undefined;
  const hasShipTo = settings.showShippingAddress && !!(quotation.shipTo?.name?.trim() || quotation.shipTo?.address?.trim());

  // Build HTML content matching DocumentRenderer
  container.innerHTML = buildDocumentHTML({
    theme,
    themeId,
    settings,
    company,
    customer,
    quotation,
    products,
    documentType,
    invoice,
    gstMode,
    taxSummary,
    totalTaxable,
    totalCgst,
    totalSgst,
    roundOff,
    roundedGrandTotal,
    docLabel,
    docNumber,
    docDate,
    dueDate,
    hasShipTo,
  });

  // Wait for images to load
  await waitForImages(container);

  // Capture with html2canvas
  const canvas = await html2canvas(container, {
    scale: 2, // Higher resolution
    useCORS: true,
    logging: false,
    backgroundColor: '#FFFFFF',
  });

  // Clean up
  document.body.removeChild(container);

  // Create PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdfWidth = 210;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  const fileName = documentType === 'invoice' && invoice ? invoice.invoiceNumber : quotation.quotationNumber;
  doc.save(`${fileName}.pdf`);
};

/**
 * Build HTML string for WYSIWYG document rendering.
 */
function buildDocumentHTML(params: {
  theme: typeof INVOICE_THEMES.luxury;
  themeId: ThemeId;
  settings: typeof DEFAULT_TEMPLATE_SETTINGS;
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  documentType: DocumentType;
  invoice?: Invoice;
  gstMode: GstMode;
  taxSummary: Map<string, { taxableAmount: number; cgstAmount: number; sgstAmount: number; cgstRate: number; sgstRate: number }>;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  roundOff: number;
  roundedGrandTotal: number;
  docLabel: string;
  docNumber: string;
  docDate: string;
  dueDate?: string;
  hasShipTo: boolean;
}): string {
  const { theme, themeId, settings, company, customer, quotation, products, taxSummary, totalTaxable, totalCgst, totalSgst, roundOff, roundedGrandTotal, docLabel, docNumber, docDate, dueDate, hasShipTo } = params;
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const gstMode = quotation.gstMode ?? 'inclusive';

  const outerBorder = theme.outerBorder ? `border: ${theme.outerBorderWidth}px solid ${theme.primaryColor};` : '';
  const cornerDecos = theme.cornerDecorations ? `
    <span style="position:absolute;font-size:18px;color:${theme.primaryColor};line-height:1;z-index:2;top:5px;left:8px;">❧</span>
    <span style="position:absolute;font-size:18px;color:${theme.primaryColor};line-height:1;z-index:2;top:5px;right:8px;transform:scaleX(-1);">❧</span>
  ` : '';

  const watermark = settings.showWatermark ? `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;overflow:hidden;">
      <span style="font-size:72px;font-weight:900;color:rgba(0,0,0,0.04);transform:rotate(-30deg);white-space:nowrap;user-select:none;">${company.companyName || 'DRAFT'}</span>
    </div>
  ` : '';

  const accentBar = theme.accentBar ? `<div style="height:3px;background-color:${theme.primaryColor};margin:10px -16px -12px;"></div>` : '';

  // Build header based on alignment
  const headerAlign = settings.headerAlignment ?? 'left';
  const headerTextColor = settings.headerTextColor ?? '#000000';
  const bodyTextColor = settings.bodyTextColor ?? '#000000';
  const tableHeaderTextColor = settings.tableHeaderTextColor ?? '#000000';
  const totalSectionColor = settings.totalSectionColor ?? '#000000';
  const logoHtml = company.logo ? `<img src="${company.logo}" alt="Logo" style="width:52px;height:42px;object-fit:contain;flex-shrink:0;${headerAlign === 'center' ? 'align-self:center;' : ''}" />` : '';

  const companyInfoInner = `
    <div style="font-size:${theme.companyNameSize}px;font-weight:700;color:${headerTextColor};line-height:1.15;letter-spacing:-0.2px;">${company.companyName || 'Company Name'}</div>
    ${company.address ? `<div style="font-size:10px;margin-top:3px;">${company.address}</div>` : ''}
    ${settings.showGstin && company.gstNumber ? `<div style="font-size:10px;margin-top:3px;">GSTIN <strong style="letter-spacing:0.3px;">${company.gstNumber}</strong></div>` : ''}
    ${settings.showPhone && company.phone ? `<div style="font-size:10px;margin-top:2px;display:flex;align-items:center;gap:4px;justify-content:${headerAlign === 'center' ? 'center' : 'flex-start'};"><span>📞</span> ${company.phone}${company.email ? '<><span style="margin:0 4px;">✉</span>' + company.email : ''}</div>` : ''}
    ${!settings.showPhone && company.email ? `<div style="font-size:10px;margin-top:2px;">✉ ${company.email}</div>` : ''}
  `;

  const docTypeLabelHtml = `<div style="font-size:${theme.docTypeFontSize}px;font-weight:800;color:${themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor};letter-spacing:1px;">${docLabel}</div>`;
  const originalBadgeHtml = `<div style="font-size:7.5px;border:1px solid ${themeId === 'stylish' ? '#FFFFFF99' : theme.primaryColor};padding:1px 7px;color:${themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor};letter-spacing:0.5px;display:inline-block;">ORIGINAL FOR RECIPIENT</div>`;

  let headerHtml: string;
  if (headerAlign === 'center') {
    headerHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;"></div>
        <div style="text-align:center;">
          <div style="font-size:${theme.docTypeFontSize}px;font-weight:800;color:${themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor};letter-spacing:1px;margin-bottom:6px;">${docLabel}</div>
          <div style="display:flex;gap:12px;align-items:flex-start;flex-direction:column;">
            ${logoHtml}
            <div style="text-align:center;">${companyInfoInner}</div>
          </div>
        </div>
        <div style="flex:1;display:flex;justify-content:flex-end;">${originalBadgeHtml}</div>
      </div>
    `;
  } else if (headerAlign === 'right') {
    headerHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="text-align:right;flex-shrink:0;padding-right:12px;">${docTypeLabelHtml}${originalBadgeHtml}</div>
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;flex-direction:row;justify-content:flex-end;">
          ${logoHtml}
          <div style="text-align:right;">${companyInfoInner}</div>
        </div>
      </div>
    `;
  } else {
    headerHtml = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="display:flex;gap:12px;align-items:flex-start;flex:1;">
          ${logoHtml}
          <div style="text-align:left;">${companyInfoInner}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;padding-left:12px;">${docTypeLabelHtml}${originalBadgeHtml}</div>
      </div>
    `;
  }

  // Build meta cells
  const metaItems: string[] = [];
  metaItems.push(`<div><div style="font-size:8.5px;color:${headerTextColor};margin-bottom:2px;">${params.documentType === 'invoice' ? 'Invoice No.' : 'Quotation No.'}</div><div style="font-weight:700;font-size:11px;">${docNumber}</div></div>`);
  metaItems.push(`<div><div style="font-size:8.5px;color:${headerTextColor};margin-bottom:2px;">${params.documentType === 'invoice' ? 'Invoice Date' : 'Quotation Date'}</div><div style="font-weight:700;font-size:11px;">${docDate}</div></div>`);
  if (settings.showDueDate) {
    metaItems.push(`<div><div style="font-size:8.5px;color:${headerTextColor};margin-bottom:2px;">Due Date</div><div style="font-weight:700;font-size:11px;color:${theme.primaryColor};">${dueDate || '—'}</div></div>`);
  }
  if (settings.showPoNumber) metaItems.push(`<div><div style="font-size:8.5px;color:${headerTextColor};margin-bottom:2px;">PO Number</div><div style="font-weight:700;font-size:11px;">—</div></div>`);
  if (settings.showEwayBill) metaItems.push(`<div><div style="font-size:8.5px;color:${headerTextColor};margin-bottom:2px;">E-Way Bill</div><div style="font-weight:700;font-size:11px;">—</div></div>`);
  if (settings.showVehicleNumber) metaItems.push(`<div><div style="font-size:8.5px;color:${headerTextColor};margin-bottom:2px;">Vehicle No.</div><div style="font-weight:700;font-size:11px;">—</div></div>`);

  // Build product rows
  const productRows = products.map((p, i) => {
    const amount = calculateProductAmount(p);
    const taxSummaryForProduct = calculateTaxSummary([p], gstMode);
    const productTaxEntry = Array.from(taxSummaryForProduct.values())[0];
    const taxAmount = productTaxEntry ? roundTo2(productTaxEntry.cgstAmount + productTaxEntry.sgstAmount) : 0;
    const rowBg = i % 2 === 1 ? theme.tableRowAltBg : '#FFFFFF';
    return `
      <tr style="background-color:${rowBg};border-bottom:1px solid ${theme.tableBorderColor};">
        <td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;color:${bodyTextColor};">${i + 1}</td>
        <td style="padding:6px 8px;text-align:left;font-size:10.5px;vertical-align:top;"><div style="font-weight:500;">${p.name}</div>${settings.showDescription && p.description && p.description.trim() ? `<div style="font-size:9.5px;color:${bodyTextColor};margin-top:2px;white-space:pre-wrap;line-height:1.4;">${p.description}</div>` : ''}</td>
        ${settings.showTax ? `<td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;color:${bodyTextColor};">${p.hsnCode || '—'}</td>` : ''}
        ${settings.showBatchNumber ? `<td style="padding:6px 8px;text-align:center;font-size:10.5px;vertical-align:top;color:${bodyTextColor};">${p.batchNumber || '—'}</td>` : ''}
        ${settings.showExpiryDate ? `<td style="padding:6px 8px;text-align:center;font-size:10.5px;vertical-align:top;color:${bodyTextColor};">${p.expiryDate || '—'}</td>` : ''}
        ${settings.showQuantity ? `<td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;color:${theme.primaryColor};">${p.quantity}${settings.showUnit ? '<span style="font-size:9px;color:${bodyTextColor};margin-left:2px;">PCS</span>' : ''}</td>` : ''}
        <td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;">${p.unitPrice.toLocaleString('en-IN')}</td>
        ${settings.showDiscount ? `<td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;color:${bodyTextColor};">${p.discount ?? 0}</td>` : ''}
        ${settings.showTax ? `<td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;"><div>${taxAmount.toLocaleString('en-IN')}</div><div style="font-size:9px;color:${bodyTextColor};">(${p.gstPercent}%)</div></td>` : ''}
        <td style="padding:6px 8px;text-align:right;font-size:10.5px;vertical-align:top;font-weight:600;">${amount.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  // Build tax summary rows
  const taxRows = Array.from(taxSummary.entries()).map(([key, data]) => {
    const [hsn, rate] = key.split('_');
    return `
      <tr style="border-top:1px solid ${theme.tableBorderColor};">
        <td style="padding:2px 5px;font-size:10px;">${hsn}</td>
        <td style="padding:2px 5px;text-align:right;font-size:10px;">${rate}%</td>
        <td style="padding:2px 5px;text-align:right;font-size:10px;">${fmt(data.taxableAmount)}</td>
        <td style="padding:2px 5px;text-align:right;font-size:10px;">${fmt(data.cgstAmount)}</td>
        <td style="padding:2px 5px;text-align:right;font-size:10px;">${fmt(data.sgstAmount)}</td>
      </tr>
    `;
  }).join('');

  // Build optional sections
  const notesSection = settings.showNotes ? `
    <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;padding:8px 16px;font-size:10.5px;">
      <span style="font-weight:700;color:${theme.primaryColor};">Notes: </span>
      <span style="color:${bodyTextColor};">${quotation.notes || 'Thank you for your business!'}</span>
    </div>
  ` : '';

  const bankSection = settings.showBankDetails ? `
    <div style="flex:1;padding:10px 16px;border-right:${(settings.showPaymentQr || settings.showSignature) ? `1px solid ${theme.sectionBorderColor}` : 'none'};">
      <div style="font-size:10px;font-weight:700;color:${theme.primaryColor};margin-bottom:4px;">Bank Details</div>
      ${company.bankName ? `<div style="font-size:10.5px;">Bank: <strong>${company.bankName}</strong></div>` : ''}
      ${company.bankAccount ? `<div style="font-size:10.5px;">A/c: <strong>${company.bankAccount}</strong></div>` : ''}
      ${company.bankIfsc ? `<div style="font-size:10.5px;">IFSC: <strong>${company.bankIfsc}</strong></div>` : ''}
      ${company.bankBranch ? `<div style="font-size:10.5px;">Branch: ${company.bankBranch}</div>` : ''}
    </div>
  ` : '';

  const qrSection = settings.showPaymentQr ? `
    <div style="padding:10px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:${settings.showSignature ? `1px solid ${theme.sectionBorderColor}` : 'none'};">
      ${quotation.paymentQr ? `<img src="${quotation.paymentQr}" alt="Payment QR" style="width:64px;height:64px;object-fit:contain;border-radius:2px;" />` : '<div style="width:64px;height:64px;border:1.5px solid ' + theme.primaryColor + ';display:flex;align-items:center;justify-content:center;font-size:9px;color:${bodyTextColor};border-radius:2px;">QR Code</div>'}
      <div style="font-size:8.5px;color:${bodyTextColor};margin-top:3px;">Scan to Pay</div>
    </div>
  ` : '';

  const sigSection = settings.showSignature ? `
    <div style="padding:10px 16px;text-align:center;min-width:130px;display:flex;flex-direction:column;justify-content:flex-end;">
      ${quotation.signature ? `<img src="${quotation.signature}" alt="Signature" style="height:45px;object-fit:contain;margin-bottom:4px;" />` : company.signature ? `<img src="${company.signature}" alt="Signature" style="height:45px;object-fit:contain;margin-bottom:4px;" />` : '<div style="height:45px;"></div>'}
      <div style="border-top:1px solid ${theme.sectionBorderColor};padding-top:4px;font-size:9px;color:${bodyTextColor};">Authorised Signatory</div>
    </div>
  ` : '';

  const hasFooter = settings.showBankDetails || settings.showPaymentQr || settings.showSignature;
  const footerSection = hasFooter ? `
    <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;display:flex;gap:0;align-items:stretch;">
      ${bankSection}
      ${qrSection}
      ${sigSection}
    </div>
  ` : '';

  const termsSection = settings.showTermsConditions ? `
    <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;padding:8px 16px;font-size:10px;">
      <div style="font-weight:700;color:${theme.primaryColor};margin-bottom:3px;">Terms &amp; Conditions</div>
      <div style="color:${bodyTextColor};line-height:1.5;white-space:pre-wrap;">
${quotation.terms || '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.'}
      </div>
    </div>
  ` : '';

  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#333;background-color:#FFFFFF;position:relative;width:100%;${outerBorder}">
      ${watermark}
      ${cornerDecos}

      <!-- Header Section -->
      <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;background-color:${theme.headerBg};color:${theme.headerTextColor};padding:14px 16px 12px;">
        ${headerHtml}
        ${accentBar}
      </div>

      <!-- Meta Section -->
      <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;padding:8px 16px;display:flex;gap:28px;flex-wrap:wrap;background-color:#FFFFFF;">
        ${metaItems.join('')}
      </div>

      <!-- Party Section -->
      <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;display:flex;min-height:60px;">
        <div style="flex:1;padding:10px 16px;border-right:${hasShipTo ? `1px solid ${theme.sectionBorderColor}` : 'none'};">
          <div style="font-size:10px;font-weight:700;color:${theme.primaryColor};margin-bottom:4px;">Bill To</div>
          <div style="font-weight:700;font-size:12px;">${customer.name}</div>
          ${settings.showBillingAddress && customer.billingAddress ? `<div style="color:${bodyTextColor};margin-top:2px;font-size:10.5px;">${customer.billingAddress}</div>` : ''}
          ${(customer.village || customer.district) ? `<div style="color:${bodyTextColor};font-size:10.5px;">${[customer.village, customer.district].filter(Boolean).join(', ')}</div>` : ''}
          ${settings.showPhone && customer.mobile ? `<div style="margin-top:2px;font-size:10.5px;">Mobile <strong>${customer.mobile}</strong></div>` : ''}
          ${settings.showGstin && customer.gstNumber ? `<div style="font-size:10.5px;">GSTIN <strong>${customer.gstNumber}</strong></div>` : ''}
        </div>
        ${hasShipTo ? `
          <div style="flex:1;padding:10px 16px;">
            <div style="font-size:10px;font-weight:700;color:${theme.primaryColor};margin-bottom:4px;">Ship To</div>
            ${quotation.shipTo?.name ? `<div style="font-weight:700;font-size:12px;">${quotation.shipTo.name}</div>` : ''}
            ${quotation.shipTo?.address ? `<div style="color:${bodyTextColor};margin-top:2px;font-size:10.5px;">${quotation.shipTo.address}</div>` : ''}
            ${settings.showPhone && quotation.shipTo?.mobile ? `<div style="margin-top:2px;font-size:10.5px;">Mobile <strong>${quotation.shipTo.mobile}</strong></div>` : ''}
            ${settings.showGstin && quotation.shipTo?.gstNumber ? `<div style="font-size:10.5px;">GSTIN <strong>${quotation.shipTo.gstNumber}</strong></div>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Product Table -->
      <table style="width:100%;border-collapse:collapse;position:relative;z-index:1;border-bottom:1px solid ${theme.sectionBorderColor};">
        <thead>
          <tr style="background-color:${theme.tableHeaderBg};color:${tableHeaderTextColor};font-weight:600;border-bottom:1.5px solid ${theme.tableBorderColor};">
            <th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:32px;">No</th>
            <th style="padding:6px 8px;text-align:left;font-weight:700;font-size:10.5px;white-space:nowrap;">Items</th>
            ${settings.showTax ? `<th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:72px;">HSN No.</th>` : ''}
            ${settings.showBatchNumber ? `<th style="padding:6px 8px;text-align:center;font-weight:700;font-size:10.5px;white-space:nowrap;width:72px;">Batch No.</th>` : ''}
            ${settings.showExpiryDate ? `<th style="padding:6px 8px;text-align:center;font-weight:700;font-size:10.5px;white-space:nowrap;width:80px;">Expiry</th>` : ''}
            ${settings.showQuantity ? `<th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:54px;">Qty.</th>` : ''}
            <th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:76px;">Rate</th>
            ${settings.showDiscount ? `<th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:70px;">Disc.</th>` : ''}
            ${settings.showTax ? `<th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:76px;">Tax</th>` : ''}
            <th style="padding:6px 8px;text-align:right;font-weight:700;font-size:10.5px;white-space:nowrap;width:84px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${productRows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#aaa;font-size:11px;">No items added</td></tr>'}
        </tbody>
      </table>

      <!-- Totals Section -->
      <div style="border-bottom:1px solid ${theme.sectionBorderColor};position:relative;z-index:1;display:flex;">
        ${settings.showTaxSummary !== false ? `
        <div style="flex:1;padding:10px 16px;border-right:1px solid ${theme.sectionBorderColor};">
          <div style="font-size:10px;font-weight:700;color:${theme.primaryColor};margin-bottom:5px;">Tax Summary</div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
              <tr style="background-color:${theme.tableHeaderBg};color:${tableHeaderTextColor};font-weight:600;">
                <th style="padding:3px 5px;text-align:left;font-weight:600;">HSN</th>
                <th style="padding:3px 5px;text-align:right;font-weight:600;">Tax%</th>
                <th style="padding:3px 5px;text-align:right;font-weight:600;">Taxable Amt</th>
                <th style="padding:3px 5px;text-align:right;font-weight:600;">CGST</th>
                <th style="padding:3px 5px;text-align:right;font-weight:600;">SGST</th>
              </tr>
            </thead>
            <tbody>
              ${taxRows}
            </tbody>
          </table>
        </div>
        ` : ''}
        <div style="width:${settings.showTaxSummary !== false ? '220px' : '100%'};padding:10px 16px;flex-shrink:0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;"><span style="color:${totalSectionColor};font-weight:600;">Sub Total</span><span style="color:${totalSectionColor};font-weight:500;">₹${fmt(totalTaxable)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;"><span style="color:${totalSectionColor};font-weight:600;">CGST</span><span style="color:${totalSectionColor};font-weight:500;">₹${fmt(totalCgst)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;"><span style="color:${totalSectionColor};font-weight:600;">SGST</span><span style="color:${totalSectionColor};font-weight:500;">₹${fmt(totalSgst)}</span></div>
          ${roundOff !== 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px;"><span style="color:${totalSectionColor};font-weight:600;">Round Off</span><span style="color:${totalSectionColor};font-weight:500;">₹${fmt(roundOff)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;border-top:1.5px solid ${theme.sectionBorderColor};padding-top:5px;margin-top:5px;font-size:13px;font-weight:700;color:${totalSectionColor};"><span>Total</span><span style="color:${totalSectionColor};">₹${fmt(roundedGrandTotal)}</span></div>
          <div style="font-size:9px;color:${totalSectionColor};margin-top:4px;font-style:italic;line-height:1.4;">${numberToWords(roundedGrandTotal)}</div>
        </div>
      </div>

      ${notesSection}
      ${footerSection}
      ${termsSection}

      <!-- Footer Strip -->
      <div style="position:relative;z-index:1;padding:5px 16px;text-align:center;font-size:8.5px;color:#aaa;border-top:1px solid ${theme.sectionBorderColor};">
        Computer-generated document. No signature required.
      </div>
    </div>
  `;
}

/**
 * Wait for all images in a container to load.
 */
function waitForImages(container: HTMLElement): Promise<void[]> {
  const images = container.querySelectorAll('img');
  return Promise.all(Array.from(images).map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Continue even if image fails
    });
  }));
}

/**
 * Legacy block-based PDF export for old templates.
 */
const exportBlockBasedPDF = (
  template: QuotationTemplate,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType = 'quotation',
  invoice?: Invoice,
  gstMode: GstMode = 'inclusive'
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const taxSummary = calculateTaxSummary(products, gstMode);
  const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
  const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
  const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
  const grandTotalAmount = calculateGrandTotalAmount(products, gstMode);
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

  const context = { company, customer, quotation, products };

  // Document title header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(documentType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION', 105, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Sort blocks by Y position to handle overlapping properly - only render canvas zone blocks in legacy mode
  const sortedBlocks = [...(template.blocks || []).filter(b => b.visible && b.zone === 'canvas')].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  for (const block of sortedBlocks) {
    const { type, content } = block;
    const x = block.x ?? 10;
    const y = block.y ?? 10;
    const width = block.width ?? 60;
    const height = block.height ?? 30;

    switch (type) {
      case 'company_logo':
        if (company.logo) {
          try {
            doc.addImage(company.logo, 'JPEG', x, y, width, height, undefined, 'FAST');
          } catch { /* Skip if image fails */ }
        }
        break;

      case 'company_details': {
        doc.setFontSize(block.style?.fontSize || 10);
        doc.setFont('helvetica', 'bold');
        doc.text(company.companyName || '', x, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(block.style?.fontSize || 9);
        let yOffset = y + 11;
        if (company.gstNumber) {
          doc.text(`GSTIN: ${company.gstNumber}`, x, yOffset);
          yOffset += 4;
        }
        if (company.address) {
          const addressLines = doc.splitTextToSize(company.address, width);
          doc.text(addressLines, x, yOffset);
          yOffset += addressLines.length * 4;
        }
        if (company.phone || company.email) {
          doc.text(`${company.phone} ${company.email}`.trim(), x, yOffset);
        }
        break;
      }

      case 'customer_details': {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill To:', x, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(customer.name || '', x, y + 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let custY = y + 15;
        if (customer.billingAddress) {
          doc.text(customer.billingAddress, x, custY);
          custY += 4;
        }
        const location = [customer.village, customer.district].filter(Boolean).join(', ');
        if (location) {
          doc.text(location, x, custY);
          custY += 4;
        }
        if (customer.mobile) {
          doc.text(`Mobile: ${customer.mobile}`, x, custY);
          custY += 4;
        }
        if (customer.gstNumber) {
          doc.text(`GSTIN: ${customer.gstNumber}`, x, custY);
        }
        break;
      }

      case 'ship_to_details': {
        const shipTo = quotation.shipTo;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Ship To:', x, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let shipY = y + 10;
        if (shipTo?.name) {
          doc.setFont('helvetica', 'bold');
          doc.text(shipTo.name, x, shipY);
          doc.setFont('helvetica', 'normal');
          shipY += 4;
        }
        if (shipTo?.address) {
          const addressLines = doc.splitTextToSize(shipTo.address, width);
          doc.text(addressLines, x, shipY);
          shipY += addressLines.length * 4;
        }
        if (shipTo?.mobile) {
          doc.text(`Mobile: ${shipTo.mobile}`, x, shipY);
          shipY += 4;
        }
        if (shipTo?.gstNumber) {
          doc.text(`GSTIN: ${shipTo.gstNumber}`, x, shipY);
        }
        break;
      }

      case 'quotation_number':
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        if (documentType === 'invoice' && invoice) {
          doc.text(`Invoice No: ${invoice.invoiceNumber}`, x, y + 5);
        } else {
          doc.text(`Quotation No: ${quotation.quotationNumber}`, x, y + 5);
        }
        break;

      case 'quotation_date':
        doc.setFontSize(9);
        if (documentType === 'invoice' && invoice) {
          doc.text(`Date: ${invoice.date}`, x, y + 5);
          if (invoice.dueDate) {
            doc.text(`Due: ${invoice.dueDate}`, x, y + 10);
          }
        } else {
          doc.text(`Date: ${quotation.date}`, x, y + 5);
        }
        break;

      case 'product_table':
        renderProductTable(doc, block, products, template.productColumns || [], x, y, width);
        break;

      case 'gst_summary':
        renderGstSummary(doc, block, taxSummary, x, y, template.productColumns || []);
        break;

      case 'bank_details':
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Bank Details:', x, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(company.bankName || '', x, y + 8);
        doc.text(`A/c: ${company.bankAccount} | IFSC: ${company.bankIfsc}`, x, y + 12);
        if (company.bankBranch) {
          doc.text(`Branch: ${company.bankBranch}`, x, y + 16);
        }
        break;

      case 'signature_box':
        if (company.signature) {
          try {
            doc.addImage(company.signature, 'JPEG', x, y, width, height - 6);
          } catch { /* Skip */ }
        }
        doc.setDrawColor(200);
        doc.line(x, y + height - 5, x + width, y + height - 5);
        doc.setFontSize(7);
        doc.text('Authorized Sign', x + width / 2, y + height - 2, { align: 'center' });
        break;

      case 'terms_conditions':
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Terms & Conditions:', x, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.text('1. Quotation valid for 30 days', x, y + 8);
        doc.text('2. 50% advance, balance on delivery', x, y + 12);
        doc.text('3. Installation included in price', x, y + 16);
        break;

      case 'footer_notes': {
        doc.setFontSize(7);
        doc.setTextColor(128);
        const footerText = resolvePlaceholders(content || 'Thank you for your business!', context);
        doc.text(footerText, x + width / 2, y + 5, { align: 'center' });
        doc.setTextColor(0);
        break;
      }

      case 'totals': {
        doc.setFontSize(8);
        const totalsX = x + width;
        const gstColVisible = (template.productColumns || []).some(c => c.key === 'gstPercent' && c.visible);
        let totalsY = y + 5;
        doc.text(`Taxable: Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, totalsY, { align: 'right' });
        if (gstColVisible) {
          totalsY += 5;
          doc.text(`CGST: Rs. ${totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, totalsY, { align: 'right' });
          totalsY += 5;
          doc.text(`SGST: Rs. ${totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, totalsY, { align: 'right' });
        }
        totalsY += 5;
        const roundOffText = roundOff >= 0
          ? `Rs. ${roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          : `(Rs. ${Math.abs(roundOff).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`;
        doc.text(`Round Off: ${roundOffText}`, totalsX, totalsY, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setDrawColor(180);
        doc.line(totalsX - 45, totalsY + 2, totalsX, totalsY + 2);
        doc.setFontSize(9);
        doc.text(`Grand Total: Rs. ${roundedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, totalsY + 7, { align: 'right' });
        totalsY += 12;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        const amountInWords = numberToWords(roundedGrandTotal);
        doc.text(`(${amountInWords})`, totalsX, totalsY, { align: 'right' });
        break;
      }

      case 'text_block': {
        doc.setFontSize(block.style?.fontSize || 9);
        const resolvedContent = resolvePlaceholders(content || '', context);
        const lines = doc.splitTextToSize(resolvedContent, width);
        doc.text(lines, x, y + 5);
        break;
      }

      case 'rectangle': {
        const s = block.style || {};
        const radius = (s.borderRadius || 0) / 3;
        if (s.filled) {
          doc.setFillColor(s.backgroundColor || '#ffffff');
          doc.roundedRect(x, y, width, height, radius, radius, 'F');
        } else {
          doc.setDrawColor(s.borderColor || '#000000');
          doc.setLineWidth(s.borderWidth || 1);
          doc.roundedRect(x, y, width, height, radius, radius, 'S');
        }
        break;
      }

      case 'horizontal_line': {
        const thickness = block.style?.thickness || 1;
        doc.setDrawColor(block.style?.color || '#000000');
        doc.setLineWidth(thickness / 3);
        doc.line(x, y + height / 2, x + width, y + height / 2);
        break;
      }

      case 'vertical_line': {
        const thickness = block.style?.thickness || 1;
        doc.setDrawColor(block.style?.color || '#000000');
        doc.setLineWidth(thickness / 3);
        doc.line(x + width / 2, y, x + width / 2, y + height);
        break;
      }

      case 'divider': {
        const thickness = block.style?.thickness || 1;
        doc.setDrawColor(block.style?.color || '#cccccc');
        doc.setLineWidth(thickness / 3);
        doc.line(x, y + height / 2, x + width, y + height / 2);
        break;
      }
    }
  }

  const fileName = documentType === 'invoice' && invoice ? invoice.invoiceNumber : quotation.quotationNumber;
  doc.save(`${fileName}.pdf`);
};

const renderProductTable = (
  doc: jsPDF,
  _block: TemplateBlock,
  products: Product[],
  columns: TableColumn[],
  x: number,
  y: number,
  width: number
) => {
  const visibleColumns = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  if (visibleColumns.length === 0) return;

  const tableData = products.map((p, i) => {
    return visibleColumns.map(col => {
      switch (col.key) {
        case 'sno': return (i + 1).toString();
        case 'name': return p.name;
        case 'hsnCode': return p.hsnCode;
        case 'gstPercent': return `${p.gstPercent}%`;
        case 'quantity': return p.quantity.toString();
        case 'unitPrice': return `Rs. ${p.unitPrice.toLocaleString('en-IN')}`;
        case 'discount': return `${p.discount ?? 0}%`;
        case 'batchNumber': return p.batchNumber || '—';
        case 'expiryDate': return p.expiryDate || '—';
        case 'amount': return `Rs. ${calculateProductAmount(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        default: return '';
      }
    });
  });

  const columnStyles: Record<string, { cellWidth: number; halign: 'left' | 'center' | 'right' }> = {};
  visibleColumns.forEach((col, i) => {
    columnStyles[i.toString()] = {
      cellWidth: (col.width / 100) * width,
      halign: col.key === 'name' || col.key === 'sno' ? 'left' : col.key === 'quantity' || col.key === 'gstPercent' ? 'center' : 'right',
    };
  });

  autoTable(doc, {
    startY: y,
    head: [visibleColumns.map(c => c.label)],
    body: tableData,
    theme: 'grid',
    margin: { left: x },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles,
    tableWidth: 'wrap',
  });
};

const renderGstSummary = (
  doc: jsPDF,
  _block: TemplateBlock,
  taxSummary: Map<string, { taxableAmount: number; cgstAmount: number; sgstAmount: number; cgstRate: number; sgstRate: number }>,
  x: number,
  y: number,
  columns: TableColumn[]
) => {
  const hsnVisible = columns.some(c => c.key === 'hsnCode' && c.visible);
  const gstVisible = columns.some(c => c.key === 'gstPercent' && c.visible);

  const tableData = Array.from(taxSummary.entries()).map(([key, data]) => {
    const hsnCode = key.split('_')[0];
    const row: (string | number)[] = [];
    if (hsnVisible) row.push(hsnCode);
    row.push(data.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    if (gstVisible) {
      row.push(`${data.cgstRate}%`);
      row.push(data.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
      row.push(`${data.sgstRate}%`);
      row.push(data.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    }
    row.push((data.taxableAmount + data.cgstAmount + data.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    return row;
  });

  const head: string[] = [];
  if (hsnVisible) head.push('HSN');
  head.push('Taxable');
  if (gstVisible) {
    head.push('CGST%');
    head.push('CGST Amt');
    head.push('SGST%');
    head.push('SGST Amt');
  }
  head.push('Total');

  autoTable(doc, {
    startY: y,
    head: [head],
    body: tableData,
    theme: 'grid',
    margin: { left: x },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
    },
    bodyStyles: {
      fontSize: 7,
    },
    columnStyles: {
      0: { halign: 'center' },
      1: { halign: 'right' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right' },
    },
    tableWidth: 'wrap',
  });
};
