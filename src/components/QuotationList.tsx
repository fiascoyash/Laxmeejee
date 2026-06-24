import { Quotation } from '../types';
import { FileText, Trash2, Copy, Edit, Calendar, User, Eye, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  quotations: Quotation[];
  onEdit: (quotation: Quotation) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function QuotationList({ quotations, onEdit, onDelete, onDuplicate }: Props) {
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);

  if (quotations.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
        <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-800 mb-2">No Quotations Yet</h3>
        <p className="text-gray-500">Create your first quotation to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {quotations.map(quotation => (
          <div
            key={quotation.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-blue-600">{quotation.quotationNumber}</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{quotation.date}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span>{quotation.customer.name || 'Unnamed Customer'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{quotation.products.length} products</span>
                  </div>
                  <div className="font-bold text-gray-800">
                    Rs. {quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewQuotation(quotation)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Preview"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onEdit(quotation)}
                  className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDuplicate(quotation.id)}
                  className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDelete(quotation.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red- hover:bg-red-50 rounded-lg transition-colors"
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Quotation Preview: {quotation.quotationNumber}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Customer Details</h4>
                <p className="text-gray-800 font-medium">{quotation.customer.name}</p>
                <p className="text-sm text-gray-600">{quotation.customer.mobile}</p>
                <p className="text-sm text-gray-600">{quotation.customer.village}, {quotation.customer.district}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date: {quotation.date}</p>
                <p className="text-sm text-gray-600">Products: {quotation.products.length}</p>
              </div>
            </div>
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-2 py-1 text-left">Product</th>
                  <th className="border border-gray-300 px-2 py-1 text-center">HSN</th>
                  <th className="border border-gray-300 px-2 py-1 text-center">GST%</th>
                  <th className="border border-gray-300 px-2 py-1 text-center">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotation.products.map((p, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 px-2 py-1">{p.name}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-mono text-xs">{p.hsnCode}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{p.gstPercent}%</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{p.quantity}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{(p.quantity * p.unitPrice).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="w-64 text-sm">
                <div className="flex justify-between py-1"><span>Taxable Amount:</span><span>Rs. {quotation.totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>CGST:</span><span>Rs. {quotation.totalCgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>SGST:</span><span>Rs. {quotation.totalSgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-2 border-t font-bold"><span>Grand Total:</span><span>Rs. {quotation.grandTotal.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
