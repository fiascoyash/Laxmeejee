import { AlertTriangle } from 'lucide-react';

interface Props {
  type: 'invoice' | 'quotation';
  duplicateNumber: string;
  existingCustomerName: string;
  existingDate: string;
  onClose: () => void;
}

function formatDate(d: string): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
}

export function DuplicateDocumentDialog({
  type,
  duplicateNumber,
  existingCustomerName,
  existingDate,
  onClose,
}: Props) {
  const label = type === 'invoice' ? 'Invoice' : 'Quotation';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Duplicate {label} Number
            </h2>
          </div>

          <div className="space-y-3 mb-6">
            <p className="text-sm text-slate-500 text-center">{label} Number:</p>
            <div className="text-center">
              <span className="inline-block text-base font-bold font-mono text-red-700 bg-red-50 rounded-lg px-5 py-2 border border-red-200">
                {duplicateNumber}
              </span>
            </div>
            <p className="text-sm text-slate-500 text-center">already exists.</p>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">
                  {existingCustomerName || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{label} Date:</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(existingDate)}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-600 text-center">
              Please use another {label} Number.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
