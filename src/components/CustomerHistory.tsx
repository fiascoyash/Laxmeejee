import { useState, useMemo } from 'react';
import {
  X, Phone, MapPin, FileText, Receipt, IndianRupee, CreditCard,
  CheckCircle, Clock, AlertCircle, BookOpen, ChevronRight, TrendingUp,
  User, Calendar,
} from 'lucide-react';
import { CustomerData, Quotation, Invoice, InvoicePayment, PAYMENT_MODE_LABELS } from '../types';

interface Props {
  customer: CustomerData;
  quotations: Quotation[];
  invoices: Invoice[];
  payments: InvoicePayment[];
  onClose: () => void;
  onEditQuotation: (quotation: Quotation) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onRecordPayment: (invoice: Invoice) => void;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtShort = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const statusColors: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-700',
  'Partial Payment': 'bg-amber-100 text-amber-700',
  Unpaid: 'bg-red-100 text-red-700',
  Draft: 'bg-slate-100 text-slate-600',
};

type Tab = 'summary' | 'ledger' | 'invoices';

export function CustomerHistory({
  customer, quotations, invoices, payments,
  onClose, onEditQuotation, onEditInvoice, onRecordPayment,
}: Props) {
  const [tab, setTab] = useState<Tab>('summary');

  const stats = useMemo(() => {
    const totalBilled = invoices.reduce((s, i) => s + i.grandTotal, 0);
    const totalReceived = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
    const totalOutstanding = Math.max(0, totalBilled - totalReceived);

    const paidCount = invoices.filter(i => i.status === 'Paid').length;
    const partialCount = invoices.filter(i => i.status === 'Partial Payment').length;
    const unpaidCount = invoices.filter(i => i.status === 'Unpaid').length;
    const draftCount = invoices.filter(i => i.status === 'Draft').length;

    const lastInvoiceDate = invoices.length > 0
      ? invoices.map(i => i.date).sort().reverse()[0]
      : null;
    const lastPaymentDate = payments.length > 0
      ? payments.map(p => p.date).sort().reverse()[0]
      : null;

    return { totalBilled, totalReceived, totalOutstanding, paidCount, partialCount, unpaidCount, draftCount, lastInvoiceDate, lastPaymentDate };
  }, [invoices, payments]);

  // Ledger entries: invoices (debits) + payments (credits) combined chronologically
  const ledgerEntries = useMemo(() => {
    type Entry = {
      date: string;
      particular: string;
      invoiceNumber: string;
      debit: number;
      credit: number;
      ref?: string;
      type: 'invoice' | 'payment';
    };

    const entries: Entry[] = [
      ...invoices.map(i => ({
        date: i.date,
        particular: `Invoice to ${i.customer.name || customer.name}`,
        invoiceNumber: i.invoiceNumber,
        debit: i.grandTotal,
        credit: 0,
        type: 'invoice' as const,
      })),
      ...payments.map(p => {
        const inv = invoices.find(i => i.id === p.invoiceId);
        return {
          date: p.date,
          particular: `Payment · ${PAYMENT_MODE_LABELS[p.mode]}${p.reference ? ` · ${p.reference}` : ''}`,
          invoiceNumber: inv?.invoiceNumber || '',
          debit: 0,
          credit: p.amount,
          type: 'payment' as const,
        };
      }),
    ].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : a.type === 'payment' ? -1 : 1;
    });

    // Running balance (from oldest to newest, then reverse for display)
    let balance = 0;
    const withBalance = [...entries].reverse().map(e => {
      balance = balance + e.debit - e.credit;
      return { ...e, balance };
    });
    return withBalance.reverse();
  }, [invoices, payments, customer.name]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">{customer.name}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.mobile}</span>
                {customer.district && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.district}</span>}
                {customer.gstNumber && <span className="font-mono">{customer.gstNumber}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 flex-shrink-0 px-6">
          {([['summary', TrendingUp, 'Summary'], ['ledger', BookOpen, 'Khata Book'], ['invoices', Receipt, 'Invoices']] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* ── SUMMARY TAB ── */}
          {tab === 'summary' && (
            <div className="space-y-5">
              {/* Key Financials */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Billed</p>
                  <p className="text-xl font-bold text-slate-800">{fmtShort(stats.totalBilled)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total Received</p>
                  <p className="text-xl font-bold text-emerald-700">{fmtShort(stats.totalReceived)}</p>
                  <p className="text-xs text-emerald-500 mt-0.5">{payments.length} payment{payments.length !== 1 ? 's' : ''}</p>
                </div>
                <div className={`rounded-xl p-4 text-center border ${stats.totalOutstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${stats.totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Outstanding</p>
                  <p className={`text-xl font-bold ${stats.totalOutstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtShort(stats.totalOutstanding)}</p>
                  <p className={`text-xs mt-0.5 ${stats.totalOutstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {stats.totalOutstanding > 0 ? 'Pending' : 'All clear'}
                  </p>
                </div>
              </div>

              {/* Invoice Status Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusCard icon={<CheckCircle className="w-4 h-4" />} count={stats.paidCount} label="Paid" color="emerald" />
                <StatusCard icon={<Clock className="w-4 h-4" />} count={stats.partialCount} label="Partial" color="amber" />
                <StatusCard icon={<AlertCircle className="w-4 h-4" />} count={stats.unpaidCount} label="Unpaid" color="red" />
                <StatusCard icon={<FileText className="w-4 h-4" />} count={stats.draftCount} label="Draft" color="slate" />
              </div>

              {/* Last Activity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Last Invoice</p>
                    <p className="text-sm font-bold text-slate-800">{stats.lastInvoiceDate || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-xs font-medium text-slate-500">Last Payment</p>
                    <p className="text-sm font-bold text-slate-800">{stats.lastPaymentDate || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Quotations */}
              {quotations.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Quotations ({quotations.length})
                  </h3>
                  <div className="space-y-2">
                    {quotations.map(q => (
                      <div
                        key={q.id}
                        onClick={() => onEditQuotation(q)}
                        className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 hover:bg-slate-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-blue-600 text-sm">{q.quotationNumber}</span>
                          <span className="text-xs text-slate-400">{q.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{fmt(q.grandTotal)}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── LEDGER / KHATA BOOK TAB ── */}
          {tab === 'ledger' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  Khata Book — Chronological Ledger
                </h3>
                <div className="text-xs text-slate-400">
                  Balance: <span className={`font-bold ${stats.totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(stats.totalOutstanding)}</span>
                </div>
              </div>

              {ledgerEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Particular</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Invoice#</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-red-500 uppercase tracking-wide">Debit</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-emerald-600 uppercase tracking-wide">Credit</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerEntries.map((entry, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${entry.type === 'payment' ? 'bg-emerald-50/30' : ''}`}>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{entry.date}</td>
                          <td className="px-4 py-3 text-slate-700 max-w-[200px]">
                            <span className="truncate block">{entry.particular}</span>
                          </td>
                          <td className="px-4 py-3">
                            {entry.invoiceNumber && (
                              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{entry.invoiceNumber}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {entry.debit > 0 ? <span className="text-red-600">{fmt(entry.debit)}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {entry.credit > 0 ? <span className="text-emerald-600">{fmt(entry.credit)}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            <span className={entry.balance > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmt(entry.balance)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Totals</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600 text-sm">{fmt(stats.totalBilled)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 text-sm">{fmt(stats.totalReceived)}</td>
                        <td className="px-4 py-3 text-right font-bold text-sm">
                          <span className={stats.totalOutstanding > 0 ? 'text-red-600' : 'text-emerald-600'}>{fmt(stats.totalOutstanding)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── INVOICES TAB ── */}
          {tab === 'invoices' && (
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No invoices yet</p>
                </div>
              ) : (
                invoices
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(inv => {
                    const amountPaid = inv.amountPaid || 0;
                    const outstanding = Math.max(0, inv.grandTotal - amountPaid);
                    return (
                      <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-600">{inv.invoiceNumber}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[inv.status] || ''}`}>
                                {inv.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{inv.date} · Due: {inv.dueDate || '—'}</p>
                          </div>
                          <div className="flex gap-2">
                            {(inv.status === 'Unpaid' || inv.status === 'Partial Payment') && (
                              <button
                                onClick={() => onRecordPayment(inv)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                              >
                                <IndianRupee className="w-3 h-3" />
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => onEditInvoice(inv)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <ChevronRight className="w-3 h-3" />
                              Open
                            </button>
                          </div>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3 text-xs">
                          <div className="text-center">
                            <p className="text-slate-400 mb-0.5">Invoice Amt</p>
                            <p className="font-bold text-slate-800">{fmt(inv.grandTotal)}</p>
                          </div>
                          <div className="text-center border-x border-slate-200">
                            <p className="text-emerald-600 mb-0.5">Received</p>
                            <p className="font-bold text-emerald-700">{fmt(amountPaid)}</p>
                          </div>
                          <div className="text-center">
                            <p className={`mb-0.5 ${outstanding > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Pending</p>
                            <p className={`font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(outstanding)}</p>
                          </div>
                        </div>

                        {/* Products */}
                        {inv.products.length > 0 && (
                          <p className="text-xs text-slate-400 mt-2 truncate">
                            {inv.products.map(p => p.name).filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, count, label, color }: {
  icon: JSX.Element; count: number; label: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className={`rounded-xl p-3 text-center ${colorMap[color] || colorMap.slate}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-xl font-bold">{count}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
