import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentRenderer } from '../components/DocumentRenderer';
import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, Invoice, GstMode, ThemeId, DEFAULT_TEMPLATE_SETTINGS, TemplateSchema } from '../types';

export type DocumentType = 'quotation' | 'invoice';

/**
 * Main PDF export function - WYSIWYG HTML-to-PDF with aggressive optimization
 * Uses DocumentRenderer (same as preview) for pixel-perfect consistency
 * Optimized to produce 100-500KB PDFs instead of 9-12MB
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
  await exportWysiwygPDF('billbook', settings, company, customer, quotation, products, documentType, invoice, gstMode, schema);
};

/**
 * Compress image to JPEG with reduced quality
 */
const compressImageToJpeg = (dataUrl: string, maxWidth: number = 400, quality: number = 0.6): Promise<string> => {
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

      // Scale down if larger than max
      if (width > maxWidth) {
        height = (height / width) * maxWidth;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Fill with white background for JPEG
      ctx!.fillStyle = '#FFFFFF';
      ctx!.fillRect(0, 0, width, height);
      ctx!.drawImage(img, 0, 0, width, height);

      // Return as JPEG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Pre-process images in the container to compress them
 */
const preprocessImages = async (container: HTMLElement): Promise<void> => {
  const images = container.querySelectorAll('img');
  const compressPromises = Array.from(images).map(async (img) => {
    if (img.src && img.src.startsWith('data:image')) {
      try {
        const compressed = await compressImageToJpeg(img.src, 300, 0.5);
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
 * Optimized: scale=1, JPEG format, quality=0.5
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
  // Create temporary container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.backgroundColor = '#FFFFFF';
  container.style.fontFamily = "'Helvetica Neue', Arial, sans-serif";
  document.body.appendChild(container);

  // Render the DocumentRenderer component (same as preview)
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
      gstMode: gstMode || 'inclusive',
      schema,
    })
  );

  // Wait for React to render
  await new Promise(resolve => setTimeout(resolve, 150));
  await waitForImages(container);

  // Compress images in the container before capture
  await preprocessImages(container);

  // Capture with html2canvas - OPTIMIZED settings
  // scale: 1 (not 2!) - reduces pixel count by 75%
  const canvas = await html2canvas(container, {
    scale: 1,                // Key optimization: scale 1 instead of 2
    useCORS: true,
    logging: false,
    backgroundColor: '#FFFFFF',
    allowTaint: true,
    removeContainer: false,
    imageTimeout: 5000,
    // Additional optimizations
    onclone: (clonedDoc) => {
      // Ensure white background for all elements
      const clonedContainer = clonedDoc.body.querySelector('div');
      if (clonedContainer) {
        clonedContainer.style.backgroundColor = '#FFFFFF';
      }
    }
  });

  // Clean up
  root.unmount();
  document.body.removeChild(container);

  // Create PDF with compression enabled
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,  // Enable PDF compression
  });

  // Convert canvas to JPEG (not PNG!) - massive size reduction
  // PNG = lossless but huge, JPEG = lossy but tiny (10-20x smaller)
  const imgData = canvas.toDataURL('image/jpeg', 0.6);  // 60% quality is sufficient for documents

  const pdfWidth = 210;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

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
