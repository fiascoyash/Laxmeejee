import { QuotationTemplate, CompanyProfile, Customer, Quotation, Product, A4_WIDTH, A4_HEIGHT, DEFAULT_TEMPLATE_SETTINGS, ThemeId } from '../types';
import { X, FileDown } from 'lucide-react';
import { exportTemplatePDF } from '../utils/templatePdfExport';
import { DocumentRenderer } from './DocumentRenderer';

interface Props {
  template: QuotationTemplate;
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  onClose: () => void;
}

const MM_TO_PX = 3.7795275591;

export function TemplatePreview({ template, company, customer, quotation, products, onClose }: Props) {
  const handleExportPDF = () => {
    exportTemplatePDF(template, company, customer, quotation, products);
  };

  // Use the new flow-based DocumentRenderer
  const themeId: ThemeId = (template as any).themeId ?? 'simple';
  const settings = template.settings ?? DEFAULT_TEMPLATE_SETTINGS;

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
              width: A4_WIDTH * MM_TO_PX,
              minHeight: A4_HEIGHT * MM_TO_PX,
            }}
          >
            <DocumentRenderer
              themeId={themeId}
              settings={settings}
              company={company}
              customer={customer}
              quotation={quotation}
              products={products}
              docType="quotation"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
