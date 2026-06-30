import { Invoice, InvoiceStatus, Customer, Product, ProductCatalogItem, CompanyProfile, QuotationTemplate, TableColumn, GstMode, ShipTo, TemplateSchema } from '../types';
import { CustomerDetails } from './CustomerDetails';
import { ProductTable } from './ProductTable';
import { Save, FileDown, Eye, Calendar, AlertCircle, Package, Trash2, PenTool, FileText } from 'lucide-react';

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
  'Draft': 'bg-slate-100 text-slate-700',
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
          <h2 className="text-xl font-bold text-slate-800">
            {invoice.sourceQuotationId ? 'Edit Invoice' : 'New Invoice'}
          </h2>
          <p className="text-sm text-slate-500">{invoice.invoiceNumber}</p>
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
            className={`px-3 py-2 border border-slate-300 rounded-md text-sm font-medium ${STATUS_COLORS[invoice.status]}`}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Invoice meta */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Invoice Date
            </label>
            <input
              type="date"
              value={invoice.date}
              onChange={(e) => update({ date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Due Date
            </label>
            <input
              type="date"
              value={invoice.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
            <input
              type="text"
              value={invoice.invoiceNumber}
              onChange={(e) => update({ invoiceNumber: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      <CustomerDetails customer={invoice.customer} onChange={updateCustomer} shipTo={invoice.shipTo} onShipToChange={updateShipTo} customFields={selectedTemplate?.schema?.customerFields || []} />

      {/* Product table (reusing ProductTable component) */}
      <ProductTable
        products={invoice.products}
        onChange={updateProducts}
        catalog={catalog}
        columns={invoice.productColumns}
        onColumnsChange={updateProductColumns}
        gstMode={invoice.gstMode || 'inclusive'}
        onGstModeChange={updateGstMode}
        templateSettings={selectedTemplate?.settings}
        schema={selectedTemplate?.schema}
        customFields={selectedTemplate?.schema?.productFields || []}
      />

      {/* Dynamic Fields based on Template Settings */}
      {selectedTemplate?.settings && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Additional Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Notes */}
            {selectedTemplate.settings.showNotes && (
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={invoice.notes || ''}
                  onChange={(e) => update({ notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Additional notes for this invoice..."
                />
              </div>
            )}

            {/* Signature Upload */}
            {selectedTemplate.settings.showSignature && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Signature</label>
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-md hover:border-blue-400 transition-colors">
                  {invoice.signature ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={invoice.signature}
                        alt="Signature"
                        className="max-h-28 max-w-full object-contain"
                      />
                      <button
                        onClick={() => update({ signature: '' })}
                        className="absolute top-1 right-1 bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-blue-600">
                      <PenTool className="w-8 h-8 mb-2" />
                      <span className="text-sm">Upload Signature</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              update({ signature: ev.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* QR Code Upload */}
            {selectedTemplate.settings.showPaymentQr && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment QR Code</label>
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-md hover:border-blue-400 transition-colors">
                  {invoice.paymentQr ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={invoice.paymentQr}
                        alt="Payment QR"
                        className="max-h-28 max-w-full object-contain"
                      />
                      <button
                        onClick={() => update({ paymentQr: '' })}
                        className="absolute top-1 right-1 bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-blue-600">
                      <FileText className="w-8 h-8 mb-2" />
                      <span className="text-sm">Upload QR Code</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              update({ paymentQr: ev.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Terms & Conditions */}
            {selectedTemplate.settings.showTermsConditions && (
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Terms & Conditions</label>
                <textarea
                  value={invoice.terms || ''}
                  onChange={(e) => update({ terms: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
                  rows={3}
                  placeholder="1. Goods once sold will not be taken back or exchanged.&#10;2. All disputes are subject to local jurisdiction only."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback Notes when no template settings */}
      {!selectedTemplate?.settings && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={invoice.notes || ''}
            onChange={(e) => update({ notes: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-blue-500"
            rows={3}
            placeholder="Additional notes for this invoice..."
          />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-end bg-white rounded-lg border border-slate-200 p-4 sticky bottom-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors order-2 sm:order-1"
        >
          Cancel
        </button>
        <button
          onClick={onPreview}
          className="px-4 py-2 border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 order-3 sm:order-2"
          title="Preview (Ctrl+P)"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={onExportPDF}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 order-1 sm:order-3"
          title="Export PDF (Ctrl+E)"
        >
          <FileDown className="w-4 h-4" />
          Export PDF
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 order-4"
          title="Save (Ctrl+S)"
        >
          <Save className="w-4 h-4" />
          Save Invoice
        </button>
      </div>
    </div>
  );
}
