import { Invoice, InvoiceStatus } from '../types';
import { FileText, Trash2, Copy, CreditCard as Edit, Eye, X, Calendar, User, Search, XCircle } from 'lucide-react';
import { useState, useMemo } from 'react';

interface Props {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  'Draft': 'bg-slate-100 text-slate-700',
  'Unpaid': 'bg-red-100 text-red-700',
  'Partial Payment': 'bg-amber-100 text-amber-700',
  'Paid': 'bg-green-100 text-green-700',
};

function matchesInvoice(inv: Invoice, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const haystack: string[] = [
    inv.invoiceNumber,
    inv.date,
    inv.dueDate,
    String(inv.grandTotal),
    String(inv.totalAmount),
    inv.customer.name,
    inv.customer.mobile,
    inv.customer.gstNumber || '',
    inv.customer.village,
    inv.customer.district,
    inv.customer.billingAddress,
    inv.shipTo?.name || '',
    inv.shipTo?.mobile || '',
    inv.shipTo?.gstNumber || '',
    inv.shipTo?.address || '',
    ...inv.products.map(p => p.name),
  ];
  return haystack.some(field => field.toLowerCase().includes(q));
}

export function InvoiceList({ invoices, onEdit, onDelete, onDuplicate }: Props) {
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = useMemo(
    () => invoices.filter(inv => matchesInvoice(inv, searchQuery)),
    [invoices, searchQuery]
  );

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">No Invoices Yet</h3>
        <p className="text-slate-500">Convert a quotation to an invoice to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search invoices..."
          className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear search"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-slate-200">
          <Search className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-800 mb-1">No invoices found</h3>
          <p className="text-slate-500">No invoices match "{searchQuery}". Try a different search term.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map(invoice => (
          <div
            key={invoice.id}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="font-bold text-blue-600">{invoice.invoiceNumber}</h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{invoice.date}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[invoice.status]}`}>
                    {invoice.status}
                  </span>
                  {invoice.sourceQuotationNumber && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded">
                      from {invoice.sourceQuotationNumber}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{invoice.customer.name || 'Unnamed Customer'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Due: {invoice.dueDate || '—'}</span>
                  </div>
                  <div className="font-bold text-slate-800">
                    Rs. {invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewInvoice(invoice)}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Preview"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onEdit(invoice)}
                  className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDuplicate(invoice.id)}
                  className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDelete(invoice.id)}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {previewInvoice && (
        <InvoicePreview invoice={previewInvoice} onClose={() => setPreviewInvoice(null)} />
      )}
    </div>
  );
}

function InvoicePreview({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Invoice Preview: {invoice.invoiceNumber}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Customer Details</h4>
                <p className="text-slate-800 font-medium">{invoice.customer.name}</p>
                <p className="text-sm text-slate-600">{invoice.customer.mobile}</p>
                <p className="text-sm text-slate-600">{invoice.customer.village}, {invoice.customer.district}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Date: {invoice.date}</p>
                <p className="text-sm text-slate-600">Due: {invoice.dueDate || '—'}</p>
                <p className="text-sm text-slate-600">Status: {invoice.status}</p>
              </div>
            </div>
            <table className="w-full text-sm border-collapse border border-slate-300">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-300 px-2 py-1 text-left">Product</th>
                  <th className="border border-slate-300 px-2 py-1 text-center">HSN/SAC</th>
                  <th className="border border-slate-300 px-2 py-1 text-center">GST%</th>
                  <th className="border border-slate-300 px-2 py-1 text-center">Qty</th>
                  <th className="border border-slate-300 px-2 py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.products.map((p, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1">{p.name}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-mono text-xs">{p.hsnSacCode}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{p.gstPercent}%</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{p.quantity}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{(p.quantity * p.unitPrice).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="w-64 text-sm">
                <div className="flex justify-between py-1"><span>Taxable Amount:</span><span>Rs. {invoice.totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>CGST:</span><span>Rs. {invoice.totalCgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>SGST:</span><span>Rs. {invoice.totalSgst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1"><span>Round Off:</span><span>Rs. {(invoice.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between py-2 border-t font-bold"><span>Grand Total:</span><span>Rs. {invoice.grandTotal.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
            {invoice.notes && (
              <div className="text-sm text-slate-600 border-t pt-3">
                <strong>Notes:</strong> {invoice.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
