import { AlertTriangle } from 'lucide-react';

interface Props {
  type: 'invoice' | 'quotation';
  customerName: string;
  amount: number;
  date: string;
  onCancel: () => void;
  onProceed: () => void;
}

function formatDate(d: string): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}

export function SimilarDocumentDialog({
  type,
  customerName,
  amount,
  date,
  onCancel,
  onProceed,
}: Props) {
  const label = type === 'invoice' ? 'Invoice' : 'Quotation';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Similar {label} Found
            </h2>
          </div>

          <div className="space-y-3 mb-6">
            <div className="bg-amber-50 rounded-lg p-4 space-y-2 text-sm border border-amber-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">{customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Amount:</span>
                <span className="font-semibold text-slate-800">
                  ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-800">{formatDate(date)}</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 text-center">
              This looks similar to an existing {label.toLowerCase()}. Do you still want to continue?
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              Create Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
