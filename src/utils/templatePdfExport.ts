import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentRenderer } from '../components/DocumentRenderer';
import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, Invoice, GstMode, ThemeId, DEFAULT_TEMPLATE_SETTINGS, TemplateSchema, INVOICE_THEMES, A4_WIDTH, A4_HEIGHT, A5_WIDTH, A5_HEIGHT, POS_WIDTH } from '../types';

export type DocumentType = 'quotation' | 'invoice';

/**
 * Main PDF export function - WYSIWYG HTML-to-PDF with balanced quality
 * Uses DocumentRenderer (same as preview) for pixel-perfect consistency
 * Produces professional-quality PDFs (300-800KB) with sharp text and borders
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

  // For theme-based templates, use WYSIWYG export with optimizations
  if (themeId) {
    await exportWysiwygPDF(themeId, settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
    return;
  }

  // Fallback for legacy templates (not commonly used)
  await exportWysiwygPDF('professional_corporate', settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
};

/**
 * Compress image with balanced quality settings
 * Maintains sharpness while keeping file size reasonable
 */
const compressImageWithQuality = (dataUrl: string, maxWidth: number = 600, quality: number = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = img.width;
      let height = img.height;

      // Scale down only if significantly larger
      if (width > maxWidth) {
        height = (height / width) * maxWidth;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Fill with white background
      ctx!.fillStyle = '#FFFFFF';
      ctx!.fillRect(0, 0, width, height);
      ctx!.drawImage(img, 0, 0, width, height);

      // Use PNG for logos/graphics to preserve sharpness
      if (width < 300) {
        resolve(canvas.toDataURL('image/png'));
      } else {
        // Use higher quality JPEG for larger images
        resolve(canvas.toDataURL('image/jpeg', quality));
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Pre-process images in the container with balanced compression
 */
const preprocessImages = async (container: HTMLElement): Promise<void> => {
  const images = container.querySelectorAll('img');
  const compressPromises = Array.from(images).map(async (img) => {
    if (img.src && img.src.startsWith('data:image')) {
      try {
        const compressed = await compressImageWithQuality(img.src, 600, 0.85);
        img.src = compressed;
      } catch {
        // Keep original if compression fails
      }
    }
  });
  await Promise.all(compressPromises);
};

/**
 * WYSIWYG PDF export - captures DocumentRenderer directly
 * Ensures exact visual match between preview and exported PDF
 * Supports A4, A5, and POS paper sizes.
 *
 * Page handling:
 *  - POS: single dynamic-height page sized to content (thermal receipt style).
 *  - A4/A5: fixed page size; content taller than one page is split across
 *    multiple pages so nothing gets cropped (totals, footer, etc.).
 */
const exportWysiwygPDF = async (
  themeId: ThemeId,
  settings: typeof DEFAULT_TEMPLATE_SETTINGS,
  company: CompanyProfile,
  customer: Customer,
  quotation: Quotation,
  products: Product[],
  documentType: DocumentType,
  invoice?: Invoice,
  gstMode?: GstMode,
  schema?: TemplateSchema
) => {
  // Get theme and paper size
  const theme = INVOICE_THEMES[themeId] ?? INVOICE_THEMES['professional_corporate'];
  const paperSize = theme.paperSize ?? 'a4';

  // Determine paper dimensions (mm)
  let paperWidth: number;
  let pageHeight: number; // per-page height for multi-page paper sizes
  let pdfFormat: 'a4' | 'a5';

  switch (paperSize) {
    case 'a5':
      paperWidth = A5_WIDTH;
      pageHeight = A5_HEIGHT;
      pdfFormat = 'a5';
      break;
    case 'pos':
      paperWidth = POS_WIDTH;
      pageHeight = 0; // dynamic — single page sized to content
      pdfFormat = 'a4'; // unused for POS (format set explicitly below)
      break;
    default: // a4
      paperWidth = A4_WIDTH;
      pageHeight = A4_HEIGHT;
      pdfFormat = 'a4';
  }

  // DocumentRenderer self-scales typography by paper size, so pass raw settings.
  const scaledSettings = settings;

  // Create temporary container for rendering. Width in mm matches the preview
  // and builder exactly so all three views render identically.
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${paperWidth}mm`;
  container.style.backgroundColor = '#FFFFFF';
  container.style.fontFamily = "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  document.body.appendChild(container);

  // Render the DocumentRenderer component (same as preview)
  const root = createRoot(container);
  root.render(
    React.createElement(DocumentRenderer, {
      themeId,
      settings: scaledSettings,
      company,
      customer,
      quotation: { ...quotation, gstMode: gstMode || quotation.gstMode || 'inclusive' },
      products,
      docType: documentType,
      invoice,
      schema,
    })
  );

  // Wait for React to render
  await new Promise(resolve => setTimeout(resolve, 150));
  await waitForImages(container);

  // Process images with balanced compression
  await preprocessImages(container);

  // Capture with html2canvas - scale 2 for sharp text/borders
  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#FFFFFF',
    allowTaint: true,
    removeContainer: false,
    imageTimeout: 5000,
    onclone: (clonedDoc) => {
      const clonedContainer = clonedDoc.body.querySelector('div');
      if (clonedContainer) {
        clonedContainer.style.backgroundColor = '#FFFFFF';
        clonedContainer.style.width = `${paperWidth}mm`;
      }
    }
  });

  // Clean up
  root.unmount();
  document.body.removeChild(container);

  // Total content height in mm, derived from the captured canvas aspect ratio.
  const totalContentHeightMm = (canvas.height * paperWidth) / canvas.width;

  const imgData = canvas.toDataURL('image/png', 0.92);

  let doc: jsPDF;

  if (paperSize === 'pos') {
    // POS: single dynamic-height page sized exactly to content. Nothing crops.
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperWidth, totalContentHeightMm],
      compress: true,
    });
    doc.addImage(imgData, 'PNG', 0, 0, paperWidth, totalContentHeightMm, undefined, 'MEDIUM');
  } else {
    // A4 / A5: fixed page size, split across multiple pages if content is
    // taller than one page. Each page draws a slice of the source canvas.
    doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: pdfFormat,
      compress: true,
    });

    const pxPerMm = canvas.width / paperWidth;
    const pageHeightPx = pageHeight * pxPerMm;
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();

      const srcY = page * pageHeightPx;
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - srcY);
      const sliceHeightMm = sliceHeightPx / pxPerMm;

      // Render this page's slice into its own canvas, then place it at the
      // top of the PDF page so content flows continuously across pages.
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      }
      const pageImgData = pageCanvas.toDataURL('image/png', 0.92);
      doc.addImage(pageImgData, 'PNG', 0, 0, paperWidth, sliceHeightMm, undefined, 'MEDIUM');
    }
  }

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
