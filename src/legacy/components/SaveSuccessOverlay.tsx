// @ts-nocheck -- original Hisaaboo code, type-checked loosely
import { useEffect } from 'react';
import { InvoiceStatus } from '../types';

export interface SaveSuccessInfo {
  kind: 'created' | 'updated';
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  warning?: string;
}

interface Props {
  info: SaveSuccessInfo;
  onView: () => void;
  onHistory: () => void;
  onClose: () => void;
}

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  Paid: 'bg-emerald-100 text-emerald-700',
  'Partial Payment': 'bg-amber-100 text-amber-700',
  Unpaid: 'bg-red-100 text-red-700',
  Draft: 'bg-slate-100 text-slate-600',
};

export function SaveSuccessOverlay({ info, onView, onHistory, onClose }: Props) {
  // Auto-dismiss simple edits after a short moment (unless there's a warning to read)
  useEffect(() => {
    if (info.kind !== 'updated' || info.warning) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [info, onClose]);

  const isNew = info.kind === 'created';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 hs-fade-in"
      onClick={onClose}
      role="dialog"
      aria-live="polite"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center hs-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <svg className="mx-auto w-16 h-16" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="hs-check-circle" cx="26" cy="26" r="24" fill="none" />
          <path className="hs-check-mark" fill="none" d="M15 27l7 7 15-15" />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          {isNew ? 'Invoice Created Successfully!' : 'Changes Saved Successfully!'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Invoice <span className="font-semibold text-slate-700">{info.invoiceNumber}</span>
        </p>
        <span className={`inline-block mt-2 px-2.5 py-1 rounded-md text-xs font-semibold ${STATUS_BADGE[info.status]}`}>
          {info.status}
        </span>
        {info.warning && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-left">
            {info.warning}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onHistory}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Invoice History
          </button>
          <button
            onClick={isNew ? onView : onClose}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {isNew ? 'View Invoice' : 'Continue Editing'}
          </button>
        </div>
      </div>
    </div>
  );
}
