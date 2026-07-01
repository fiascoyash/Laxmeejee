import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentRenderer } from '../components/DocumentRenderer';
import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, TemplateBlock, TableColumn, Invoice, GstMode, ThemeId, DEFAULT_TEMPLATE_SETTINGS, TemplateSchema } from '../types';
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
  const schema = template.schema;

  // Use WYSIWYG export for theme-based templates (single source of truth with DocumentRenderer)
  if (themeId) {
    await exportFlowBasedPDF(themeId, settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
    return;
  }

  // Legacy block-based export
  exportBlockBasedPDF(template, company, customer, quotation, products, documentType, invoice, gstMode);
};

/**
 * WYSIWYG PDF export for flow-based templates.
 * Renders the DocumentRenderer component directly, then captures with html2canvas.
 * This ensures the PDF uses exactly the same styling engine as the on-screen preview.
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
  gstMode: GstMode = 'inclusive',
  schema?: TemplateSchema
) => {
  // Create a temporary container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.backgroundColor = '#FFFFFF';
  document.body.appendChild(container);

  // Render the DocumentRenderer component (single source of truth)
  const root = createRoot(container);
  root.render(
    React.createElement(DocumentRenderer, {
      themeId,
      settings,
      company,
      customer,
      quotation,
      products,
      docType: documentType,
      invoice,
      schema,
    })
  );

  // Allow React to finish rendering before capture
  await new Promise(resolve => setTimeout(resolve, 150));
  await waitForImages(container);

  // Capture with html2canvas
  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#FFFFFF',
  });

  // Clean up
  root.unmount();
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
        case 'hsnSacCode': return p.hsnSacCode;
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
  const hsnSacVisible = columns.some(c => c.key === 'hsnSacCode' && c.visible);
  const gstVisible = columns.some(c => c.key === 'gstPercent' && c.visible);

  const tableData = Array.from(taxSummary.entries()).map(([key, data]) => {
    const hsnSacCode = key.split('_')[0];
    const row: (string | number)[] = [];
    if (hsnSacVisible) row.push(hsnSacCode);
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
  if (hsnSacVisible) head.push('HSN/SAC');
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
