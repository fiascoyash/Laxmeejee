import { Invoice, InvoiceStatus, Customer, Product, ProductCatalogItem, CompanyProfile, QuotationTemplate, TableColumn, GstMode, ShipTo } from '../types';
import { CustomerDetails } from './CustomerDetails';
import { ProductTable } from './ProductTable';
import { Save, FileDown, Eye, Calendar, AlertCircle, Package } from 'lucide-react';

interface Props {
  invoice: Invoice;
  catalog: ProductCatalogItem[];
  companyProfile: CompanyProfile;
  selectedTemplate: QuotationTemplate | undefined;
  onChange: (invoice: Invoice) => void;
  onSave: () => void;
  onExportPDF: () => void;
  onPreview: () => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: InvoiceStatus[] = ['Draft', 'Unpaid', 'Partial Payment', 'Paid'];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  'Draft': 'bg-gray-100 text-gray-700',
  'Unpaid': 'bg-red-100 text-red-700',
  'Partial Payment': 'bg-amber-100 text-amber-700',
  'Paid': 'bg-green-100 text-green-700',
};

export function InvoiceForm({
  invoice,
  catalog,
  selectedTemplate,
  onChange,
  onSave,
  onExportPDF,
  onPreview,
  onCancel,
}: Props) {
  const update = (patch: Partial<Invoice>) => onChange({ ...invoice, ...patch });
  const updateCustomer = (customer: Customer) => update({ customer });
  const updateShipTo = (shipTo: ShipTo) => update({ shipTo });
  const updateProducts = (products: Product[]) => update({ products });
  const updateProductColumns = (productColumns: TableColumn[]) => update({ productColumns });
  const updateGstMode = (gstMode: GstMode) => update({ gstMode });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {invoice.sourceQuotationId ? 'Edit Invoice' : 'New Invoice'}
          </h2>
          <p className="text-sm text-gray-500">{invoice.invoiceNumber}</p>
          {invoice.sourceQuotationNumber && (
            <p className="text-xs text-amber-600 mt-1">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Converted from Quotation: {invoice.sourceQuotationNumber}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
          {selectedTemplate && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm">
              <Package className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700 font-medium">{selectedTemplate.name}</span>
            </div>
          )}
          <select
            value={invoice.status}
            onChange={(e) => update({ status: e.target.value as InvoiceStatus })}
            className={`px-3 py-2 border border-gray-300 rounded-md text-sm font-medium ${STATUS_COLORS[invoice.status]}`}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoice meta */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Invoice Date
            </label>
            <input
              type="date"
              value={invoice.date}
              onChange={(e) => update({ date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Due Date
            </label>
            <input
              type="date"
              value={invoice.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <input
              type="text"
              value={invoice.invoiceNumber}
              onChange={(e) => update({ invoiceNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      <CustomerDetails customer={invoice.customer} onChange={updateCustomer} shipTo={invoice.shipTo} onShipToChange={updateShipTo} />

      {/* Product table (reusing ProductTable component) */}
      <ProductTable
        products={invoice.products}
        onChange={updateProducts}
        catalog={catalog}
        columns={invoice.productColumns}
        onColumnsChange={updateProductColumns}
        gstMode={invoice.gstMode || 'inclusive'}
        onGstModeChange={updateGstMode}
      />

      {/* Notes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={invoice.notes || ''}
          onChange={(e) => update({ notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="Additional notes for this invoice..."
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end bg-white rounded-lg border border-gray-200 p-4 sticky bottom-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1"
        >
          Cancel
        </button>
        <button
          onClick={onPreview}
          className="px-4 py-2 border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 order-3 sm:order-2"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={onExportPDF}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 order-1 sm:order-3"
        >
          <FileDown className="w-4 h-4" />
          Export PDF
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 order-4"
        >
          <Save className="w-4 h-4" />
          Save Invoice
        </button>
      </div>
    </div>
  );
}
