import { Quotation } from '../types';
import { FileText, Trash2, Copy, CreditCard as Edit, Calendar, User, Eye, X, FileInput } from 'lucide-react';
import { useState } from 'react';

interface Props {
  quotations: Quotation[];
  onEdit: (quotation: Quotation) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onConvertToInvoice: (quotation: Quotation) => void;
}

export function QuotationList({ quotations, onEdit, onDelete, onDuplicate, onConvertToInvoice }: Props) {
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  if (quotations.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">No Quotations Yet</h3>
        <p className="text-slate-500">Create your first quotation to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:gap-4">
        {quotations.map(quotation => (
          <div
            key={quotation.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 hover:shadow-md transition-shadow"
          >
            {/* Mobile Layout */}
            <div className="sm:hidden">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-bold text-blue-600 text-base">{quotation.quotationNumber}</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{quotation.date}</span>
                </div>
                <div className="font-bold text-lg text-slate-800">
                  Rs. {quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </div>
              </div>
              <div className="text-sm text-slate-600 mb-3">
                <User className="w-4 h-4 text-slate-400 inline mr-2" />
                {quotation.customer.name || 'Unnamed Customer'}
                <span className="mx-2">|</span>
                {quotation.products.length} products
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPreviewQuotation(quotation)}
                  className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button
                  onClick={() => onEdit(quotation)}
                  className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Edit className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => onConvertToInvoice(quotation)}
                  className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <FileInput className="w-4 h-4" /> Invoice
                </button>
                <button
                  onClick={() => onDuplicate(quotation.id)}
                  className="flex-1 min-w-[calc(50%-4px)] px-3 py-2.5 text-slate-700 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
                <button
                  onClick={() => onDelete(quotation.id)}
                  className="w-full px-3 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden sm:flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-blue-600">{quotation.quotationNumber}</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{quotation.date}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{quotation.customer.name || 'Unnamed Customer'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{quotation.products.length} products</span>
                  </div>
                  <div className="font-bold text-slate-800">
                    Rs. {quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewQuotation(quotation)}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Preview"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onEdit(quotation)}
                  className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Edit"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onConvertToInvoice(quotation)}
                  className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Convert to Invoice"
                >
                  <FileInput className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDuplicate(quotation.id)}
                  className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Duplicate"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDelete(quotation.id)}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewQuotation && (
        <QuotationPreview quotation={previewQuotation} onClose={() => setPreviewQuotation(null)} />
      )}
    </div>
  );
}

function QuotationPreview({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 safe-area-inset">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b bg-slate-50">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate pr-2">Preview: {quotation.quotationNumber}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-120px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <h4 className="font-semibold text-slate-700 mb-2 text-sm sm:text-base">Customer Details</h4>
                <p className="text-slate-800 font-medium">{quotation.customer.name}</p>
                <p className="text-sm text-slate-600">{quotation.customer.mobile}</p>
                <p className="text-sm text-slate-600">{quotation.customer.village}, {quotation.customer.district}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-slate-600">Date: {quotation.date}</p>
                <p className="text-sm text-slate-600">Products: {quotation.products.length}</p>
              </div>
            </div>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full text-sm border-collapse border border-gray-300 min-w-[500px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-gray-300 px-2 py-2 text-left">Product</th>
                    <th className="border border-gray-300 px-2 py-2 text-center">HSN/SAC</th>
                    <th className="border border-gray-300 px-2 py-2 text-center">GST%</th>
                    <th className="border border-gray-300 px-2 py-2 text-center">Qty</th>
                    <th className="border border-gray-300 px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.products.map((p, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-2">{p.name}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center font-mono text-xs">{p.hsnSacCode}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{p.gstPercent}%</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{p.quantity}</td>
                      <td className="border border-gray-300 px-2 py-2 text-right">{(p.quantity * p.unitPrice).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="w-full sm:w-64 text-sm">
                <div className="flex justify-between py-1"><span>Taxable Amount:</span><span>Rs. {quotation.totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>CGST:</span><span>Rs. {quotation.totalCgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>SGST:</span><span>Rs. {quotation.totalSgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>Round Off:</span><span>Rs. {(quotation.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between py-2 border-t font-bold text-base"><span>Grand Total:</span><span>Rs. {quotation.grandTotal.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
