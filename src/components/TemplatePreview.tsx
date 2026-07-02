import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, A4_WIDTH, A4_HEIGHT, A5_WIDTH, A5_HEIGHT, POS_WIDTH, DEFAULT_TEMPLATE_SETTINGS, ThemeId, Invoice, GstMode, INVOICE_THEMES } from '../types';
import { X, FileDown } from 'lucide-react';
import { exportTemplatePDF, DocumentType } from '../utils/templatePdfExport';
import { DocumentRenderer } from './DocumentRenderer';

interface Props {
  template: QuotationTemplate;
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  onClose: () => void;
  documentType?: DocumentType;
  invoice?: Invoice;
  gstMode?: GstMode;
}

export function TemplatePreview({ template, company, customer, quotation, products, onClose, documentType = 'quotation', invoice, gstMode = 'inclusive' }: Props) {
  const handleExportPDF = () => {
    exportTemplatePDF(template, company, customer, quotation, products, documentType, invoice, gstMode);
  };

  // Use the new flow-based DocumentRenderer
  const themeId: ThemeId = (template as any).themeId ?? 'professional_corporate';
  const settings = template.settings ?? DEFAULT_TEMPLATE_SETTINGS;
  const theme = INVOICE_THEMES[themeId] ?? INVOICE_THEMES['professional_corporate'];

  // Get paper dimensions based on theme. POS height is dynamic (content-driven),
  // matching the export path so preview and PDF render identically.
  const getPaperDimensions = () => {
    switch (theme.paperSize) {
      case 'a5':
        return { width: A5_WIDTH, height: A5_HEIGHT };
      case 'pos':
        return { width: POS_WIDTH, height: 0 };
      default: // a4
        return { width: A4_WIDTH, height: A4_HEIGHT };
    }
  };
  const paperDims = getPaperDimensions();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-full overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Template Preview: {template.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-gray-200 flex justify-center">
          <div
            className="bg-white shadow-2xl relative"
            style={{
              width: `${paperDims.width}mm`,
              minHeight: paperDims.height > 0 ? `${paperDims.height}mm` : undefined,
            }}
          >
            <DocumentRenderer
              themeId={themeId}
              settings={settings}
              company={company}
              customer={customer}
              quotation={quotation}
              products={products}
              docType={documentType}
              schema={template.schema}
              invoice={invoice}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
