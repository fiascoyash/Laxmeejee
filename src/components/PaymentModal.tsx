import { useState } from 'react';
import { X, Plus, Trash2, CreditCard, IndianRupee, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Invoice, InvoicePayment, PaymentMode, PAYMENT_MODE_LABELS } from '../types';
import { generateId } from '../utils/storage';

interface Props {
  invoice: Invoice;
  payments: InvoicePayment[];
  onAddPayment: (payment: InvoicePayment) => void;
  onDeletePayment: (paymentId: string, invoiceId: string) => void;
  onClose: () => void;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MODES: { value: PaymentMode; label: string }[] = (
  Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[]
).map(k => ({ value: k, label: PAYMENT_MODE_LABELS[k] }));

export function PaymentModal({ invoice, payments, onAddPayment, onDeletePayment, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(payments.length === 0);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, invoice.grandTotal - totalPaid);
  const isDraft = invoice.status === 'Draft';

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (amt > outstanding) {
      setError(`Amount cannot exceed outstanding balance of ${fmt(outstanding)}.`);
      return;
    }
    if (!date) {
      setError('Please select a payment date.');
      return;
    }
    const payment: InvoicePayment = {
      id: generateId(),
      invoiceId: invoice.id,
      date,
      amount: amt,
      mode,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onAddPayment(payment);
    setAmount('');
    setReference('');
    setNotes('');
    setError('');
    setShowForm(false);
  };

  const statusColors: Record<string, string> = {
    Paid: 'bg-emerald-100 text-emerald-700',
    'Partial Payment': 'bg-amber-100 text-amber-700',
    Unpaid: 'bg-red-100 text-red-700',
    Draft: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Record Payment</h2>
              <p className="text-xs text-slate-400">{invoice.invoiceNumber} · {invoice.customer.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Invoice Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Invoice Total</p>
              <p className="text-sm font-bold text-slate-800">{fmt(invoice.grandTotal)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-emerald-600 mb-1">Received</p>
              <p className="text-sm font-bold text-emerald-700">{fmt(totalPaid)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${outstanding > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <p className={`text-xs mb-1 ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Outstanding</p>
              <p className={`text-sm font-bold ${outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(outstanding)}</p>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[invoice.status] || ''}`}>
              {invoice.status}
            </span>
            {outstanding === 0 && <CheckCircle className="w-4 h-4 text-emerald-500" />}
            {outstanding > 0 && totalPaid > 0 && <Clock className="w-4 h-4 text-amber-500" />}
            {totalPaid === 0 && !isDraft && <AlertCircle className="w-4 h-4 text-red-400" />}
          </div>

          {/* Existing Payments */}
          {payments.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Payment History</h3>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <IndianRupee className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-700">{fmt(p.amount)}</span>
                        <span className="text-xs text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">{PAYMENT_MODE_LABELS[p.mode]}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {p.date}
                        {p.reference && <span className="ml-2">· Ref: {p.reference}</span>}
                        {p.notes && <span className="ml-2">· {p.notes}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeletePayment(p.id, invoice.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                      title="Delete payment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {outstanding > 0 && !isDraft && (
            <>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Payment
                </button>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 mb-1">New Payment</h3>

                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={date}
                        max={today}
                        onChange={e => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Amount (max {fmt(outstanding)})
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={e => { setAmount(e.target.value); setError(''); }}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode</label>
                    <select
                      value={mode}
                      onChange={e => setMode(e.target.value as PaymentMode)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Reference No. <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder="Cheque no, UTR, transaction ID..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setShowForm(false); setError(''); setAmount(''); }}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Save Payment
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {outstanding === 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              This invoice is fully paid.
            </div>
          )}

          {isDraft && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Payments cannot be recorded for Draft invoices. Change the status first.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
