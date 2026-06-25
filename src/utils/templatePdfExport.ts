import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, TemplateBlock, TableColumn, Invoice } from '../types';
import { calculateProductAmount, calculateTaxSummary } from './storage';
import { resolvePlaceholders } from './placeholders';

export type DocumentType = 'quotation' | 'invoice';

export const exportTemplatePDF = (
  template: QuotationTemplate,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType = 'quotation',
  invoice?: Invoice
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totalAmount = products.reduce((sum, p) => sum + calculateProductAmount(p), 0);
  const taxSummary = calculateTaxSummary(products);
  const totalCgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0);
  const totalSgst = Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0);
  const grandTotal = totalAmount + totalCgst + totalSgst;

  const context = { company, customer, quotation, products };

  // Document title header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(documentType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION', 105, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Sort blocks by Y position to handle overlapping properly
  const sortedBlocks = [...template.blocks.filter(b => b.visible)].sort((a, b) => a.y - b.y);

  for (const block of sortedBlocks) {
    const { type, x, y, width, height, content } = block;

    switch (type) {
      case 'company_logo':
        if (company.logo) {
          try {
            const imgData = company.logo;
            // Calculate aspect ratio
            doc.addImage(imgData, 'JPEG', x, y, width, height, undefined, 'FAST');
          } catch {
            // Skip if image fails
          }
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
        renderGstSummary(doc, block, taxSummary, x, y);
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
          } catch {
            // Skip
          }
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
        doc.text(`Taxable: Rs. ${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, y + 5, { align: 'right' });
        doc.text(`CGST: Rs. ${totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, y + 10, { align: 'right' });
        doc.text(`SGST: Rs. ${totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, y + 15, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setDrawColor(180);
        doc.line(totalsX - 45, y + 17, totalsX, y + 17);
        doc.setFontSize(9);
        doc.text(`Grand Total: Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, y + 22, { align: 'right' });
        break;
      }

      case 'text_block': {
        doc.setFontSize(block.style?.fontSize || 9);
        const resolvedContent = resolvePlaceholders(content || '', context);
        const lines = doc.splitTextToSize(resolvedContent, width);
        doc.text(lines, x, y + 5);
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
  y: number
) => {
  const tableData = Array.from(taxSummary.entries()).map(([key, data]) => {
    const hsnCode = key.split('_')[0];
    return [
      hsnCode,
      data.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      `${data.cgstRate}%`,
      data.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      `${data.sgstRate}%`,
      data.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['HSN', 'Taxable', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt']],
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
