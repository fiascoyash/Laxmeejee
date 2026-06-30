import { CustomerData, Quotation, Invoice } from '../types';
import { X, Phone, MapPin, MapPinned, FileText, Receipt, IndianRupee, Calendar } from 'lucide-react';

interface Props {
  customer: CustomerData;
  quotations: Quotation[];
  invoices: Invoice[];
  onClose: () => void;
  onEditQuotation: (quotation: Quotation) => void;
  onEditInvoice: (invoice: Invoice) => void;
}

export function CustomerHistory({
  customer,
  quotations,
  invoices,
  onClose,
  onEditQuotation,
  onEditInvoice,
}: Props) {
  const totalQuotations = quotations.length;
  const totalInvoices = invoices.length;
  const totalBusinessValue = quotations.reduce((sum, q) => sum + q.grandTotal, 0) + invoices.reduce((sum, i) => sum + i.grandTotal, 0);
  const pendingAmount = invoices.filter(i => i.status === 'Unpaid' || i.status === 'Partial Payment').reduce((sum, i) => sum + i.grandTotal, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Customer Profile</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Customer Info */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h3 className="text-xl font-bold text-slate-800 mb-3">{customer.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>{customer.mobile}</span>
              </div>
              {customer.gstNumber && (
                <div className="text-slate-600">
                  <span className="font-medium">GSTIN:</span> {customer.gstNumber}
                </div>
              )}
              {customer.email && (
                <div className="text-slate-600">
                  <span className="font-medium">Email:</span> {customer.email}
                </div>
              )}
              {customer.district && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>{customer.district}</span>
                  {customer.village && <span className="text-slate-400">, {customer.village}</span>}
                </div>
              )}
              {customer.billingAddress && (
                <div className="flex items-start gap-2 text-slate-600 md:col-span-2">
                  <MapPinned className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>{customer.billingAddress}</span>
                </div>
              )}
              {customer.deliveryAddress && (
                <div className="text-slate-600 md:col-span-2">
                  <span className="font-medium">Delivery:</span> {customer.deliveryAddress}
                </div>
              )}
              {customer.notes && (
                <div className="text-slate-600 md:col-span-2">
                  <span className="font-medium">Notes:</span> {customer.notes}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{totalQuotations}</div>
              <div className="text-xs text-blue-700">Quotations</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{totalInvoices}</div>
              <div className="text-xs text-amber-700">Invoices</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-600">Rs. {totalBusinessValue.toLocaleString()}</div>
              <div className="text-xs text-emerald-700">Total Business</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-600">Rs. {pendingAmount.toLocaleString()}</div>
              <div className="text-xs text-red-700">Pending Amount</div>
            </div>
          </div>

          {/* Quotations History */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Quotations History
            </h4>
            {quotations.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">No quotations yet</div>
            ) : (
              <div className="space-y-2">
                {quotations.map(q => (
                  <div
                    key={q.id}
                    onClick={() => onEditQuotation(q)}
                    className="flex items-center justify-between bg-slate-50 rounded-lg p-3 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-emerald-600">{q.quotationNumber}</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-600 text-sm">{q.date}</span>
                    </div>
                    <span className="font-medium text-slate-800">Rs. {q.grandTotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices History */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Invoice History
            </h4>
            {invoices.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">No invoices yet</div>
            ) : (
              <div className="space-y-2">
                {invoices.map(i => (
                  <div
                    key={i.id}
                    onClick={() => onEditInvoice(i)}
                    className="flex items-center justify-between bg-slate-50 rounded-lg p-3 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-amber-600">{i.invoiceNumber}</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-600 text-sm">{i.date}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        i.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        i.status === 'Partial Payment' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {i.status}
                      </span>
                    </div>
                    <span className="font-medium text-slate-800">Rs. {i.grandTotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
