import React from 'react';
import { X, FileText, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
import { Invoice } from '../../types';
import { ValidationIssue, formatCurrency, formatDate } from '../../utils/gstReports';

interface InvoiceIssueModalProps {
  issue: ValidationIssue;
  invoices: Invoice[];
  onClose: () => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const InvoiceIssueModal: React.FC<InvoiceIssueModalProps> = ({
  issue,
  invoices,
  onClose,
  onEditInvoice,
}) => {
  // Filter invoices that have this issue
  const affectedInvoices = invoices.filter(inv => issue.affectedInvoiceIds.includes(inv.id));

  const getSeverityIcon = () => {
    switch (issue.severity) {
      case 'success':
        return null;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getSeverityColor = () => {
    switch (issue.severity) {
      case 'success':
        return 'text-emerald-600 bg-emerald-50';
      case 'warning':
        return 'text-amber-600 bg-amber-50';
      case 'error':
        return 'text-red-600 bg-red-50';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            {getSeverityIcon()}
            <div>
              <h2 className="text-lg font-bold text-slate-800">{issue.name}</h2>
              <p className="text-sm text-slate-500">{issue.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor()}`}>
              {affectedInvoices.length} invoice{affectedInvoices.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Invoice List */}
        <div className="flex-1 overflow-y-auto p-4">
          {affectedInvoices.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No invoices found with this issue.
            </div>
          ) : (
            <div className="space-y-3">
              {affectedInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-emerald-600">
                          {invoice.invoiceNumber}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-sm text-slate-500">
                          {formatDate(invoice.date)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-slate-400 text-xs">Customer</p>
                          <p className="text-slate-700 font-medium truncate">
                            {invoice.customer.name || <span className="text-red-400">Missing</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">GSTIN</p>
                          <p className="text-slate-700 font-mono text-xs truncate">
                            {invoice.customer.gstNumber || <span className="text-amber-400">Missing</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Taxable Amount</p>
                          <p className="text-slate-700 font-medium">
                            {formatCurrency(invoice.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs">Grand Total</p>
                          <p className="text-slate-800 font-bold">
                            {formatCurrency(invoice.grandTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                    {onEditInvoice && (
                      <button
                        onClick={() => {
                          onEditInvoice(invoice);
                          onClose();
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Tip: Click on an invoice to open and fix the issue
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
