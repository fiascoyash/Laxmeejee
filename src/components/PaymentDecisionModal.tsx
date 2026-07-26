import { useState, useMemo } from 'react';
import {
  X, FileEdit, AlertCircle, CreditCard, CheckCircle2, IndianRupee,
} from 'lucide-react';
import { Invoice, InvoicePayment, InvoiceStatus, PaymentMode, PAYMENT_MODE_LABELS } from '../types';
import { generateId, roundTo2 } from '../utils/storage';

export type PaymentDecision =
  | { kind: 'draft' }
  | { kind: 'unpaid' }
  | { kind: 'receive'; payment: InvoicePayment }
  | { kind: 'paid'; payment: InvoicePayment };

interface Props {
  invoice: Invoice;
  existingPayments: InvoicePayment[];
  onConfirm: (decision: PaymentDecision) => void;
  onClose: () => void;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MODES: { value: PaymentMode; label: string }[] = (
  Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]
).map(k => ({ value: k, label: PAYMENT_MODE_LABELS[k] }));

export function PaymentDecisionModal({ invoice, existingPayments, onConfirm, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // Start from any payments already recorded against this invoice so that the
  // "receive / paid" options layer on top of existing history instead of
  // resetting it. The received field defaults to the outstanding amount.
  const previouslyPaid = useMemo(
    () => existingPayments.reduce((s, p) => s + p.amount, 0),
    [existingPayments],
  );

  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const invoiceTotal = invoice.grandTotal;
  const outstandingBefore = Math.max(0, roundTo2(invoiceTotal - previouslyPaid));

  const enteredAmount = amount ? parseFloat(amount) : 0;
  const receivedNow = isNaN(enteredAmount) ? 0 : roundTo2(enteredAmount);
  const totalReceived = roundTo2(previouslyPaid + receivedNow);
  const outstanding = roundTo2(Math.max(0, invoiceTotal - totalReceived));

  const liveStatus: InvoiceStatus =
    receivedNow <= 0
      ? outstandingBefore > 0
        ? 'Unpaid'
        : 'Paid'
      : outstanding <= 0
        ? 'Paid'
        : 'Partial Payment';

  const buildPayment = (amt: number): InvoicePayment => ({
    id: generateId(),
    invoiceId: invoice.id,
    date: today,
    amount: roundTo2(amt),
    mode,
    reference: reference.trim() || undefined,
    notes: notes.trim() || undefined,
    createdAt: new Date().toISOString(),
  });

  const handleReceive = () => {
    if (!amount || isNaN(enteredAmount) || receivedNow <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (receivedNow > outstandingBefore) {
      setError(`Amount cannot exceed outstanding balance of ${fmt(outstandingBefore)}.`);
      return;
    }
    setError('');
    onConfirm({ kind: 'receive', payment: buildPayment(receivedNow) });
  };

  const handlePaid = () => {
    if (outstandingBefore <= 0) {
      setError('This invoice already has no outstanding balance.');
      return;
    }
    setError('');
    onConfirm({ kind: 'paid', payment: buildPayment(outstandingBefore) });
  };

  const statusBadge: Record<InvoiceStatus, string> = {
    Paid: 'bg-emerald-100 text-emerald-700',
    'Partial Payment': 'bg-amber-100 text-amber-700',
    Unpaid: 'bg-red-100 text-red-700',
    Draft: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Save Invoice</h2>
              <p className="text-xs text-slate-400">
                {invoice.invoiceNumber} · {invoice.customer.name || 'Untitled customer'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Live calculation summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Invoice Total</p>
              <p className="text-sm font-bold text-slate-800">{fmt(invoiceTotal)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-emerald-600 mb-1">Received</p>
              <p className="text-sm font-bold text-emerald-700">{fmt(totalReceived)}</p>
            </div>
            <div
              className={`rounded-xl p-3 text-center ${
                outstanding > 0 ? 'bg-red-50' : 'bg-emerald-50'
              }`}
            >
              <p
                className={`text-xs mb-1 ${
                  outstanding > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                Outstanding
              </p>
              <p
                className={`text-sm font-bold ${
                  outstanding > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {fmt(outstanding)}
              </p>
            </div>
          </div>

          {/* Live status */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                statusBadge[liveStatus]
              }`}
            >
              {liveStatus}
            </span>
            {previouslyPaid > 0 && (
              <span className="text-xs text-slate-400">
                {fmt(previouslyPaid)} already received
              </span>
            )}
          </div>

          {/* Payment input area — drives the live calculation */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Payment Received</h3>
              <span className="text-xs text-slate-400">
                Leave blank to save without a payment
              </span>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Amount Received
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAmount(String(outstandingBefore));
                    setError('');
                  }}
                  className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-white transition-colors"
                >
                  Full {fmt(outstandingBefore)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAmount(String(roundTo2(outstandingBefore / 2)));
                    setError('');
                  }}
                  className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-white transition-colors"
                >
                  Half
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAmount('');
                    setError('');
                  }}
                  className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-white transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Payment Mode
                </label>
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value as PaymentMode)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  {MODES.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Reference No.{' '}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="Cheque no, UTR, txn ID..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional note..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Four save actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0 space-y-2">
          <button
            onClick={handlePaid}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark Fully Paid ({fmt(outstandingBefore)})
          </button>

          <button
            onClick={handleReceive}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Save &amp; Receive Payment
            {receivedNow > 0 && receivedNow <= outstandingBefore && (
              <span className="ml-1 text-blue-100">· {fmt(receivedNow)}</span>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onConfirm({ kind: 'unpaid' })}
              className="px-4 py-2.5 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Save as Unpaid
            </button>
            <button
              onClick={() => onConfirm({ kind: 'draft' })}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
            >
              <FileEdit className="w-4 h-4" />
              Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
