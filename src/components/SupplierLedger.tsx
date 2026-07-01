import { useState, useMemo } from 'react';
import {
  SupplierData, SupplierTransaction, SupplierTransactionType, SupplierPaymentMethod,
} from '../types';
import { storage, generateId } from '../utils/storage';
import {
  ArrowLeft, Plus, CreditCard, Truck, Phone, Mail, MapPin, FileText,
  Clock, TrendingUp, BarChart2, X, Save, AlertCircle, CheckCircle2,
} from 'lucide-react';

interface Props {
  supplier: SupplierData;
  onBack: () => void;
  onEdit: (supplier: SupplierData) => void;
}

type ModalType = 'purchase' | 'payment' | null;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TRANSACTION_TYPE_LABELS: Record<SupplierTransactionType, string> = {
  purchase_entry: 'Purchase Entry',
  payment_made: 'Payment Made',
  purchase_return: 'Purchase Return',
  debit_note: 'Debit Note',
  credit_note: 'Credit Note',
  opening_balance: 'Opening Balance',
};

const PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
};

export function SupplierLedger({ supplier, onBack, onEdit }: Props) {
  const [modal, setModal] = useState<ModalType>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Purchase form state
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseDescription, setPurchaseDescription] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState<number>(0);
  const [purchaseRef, setPurchaseRef] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseType, setPurchaseType] = useState<SupplierTransactionType>('purchase_entry');

  // Payment form state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const transactions = useMemo(() => {
    return storage.getSupplierTransactionsBySupplierId(supplier.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id, refreshKey]);

  // Opening balance: positive = we owe, negative = advance
  const openingBalance = supplier.openingBalanceType === 'to_pay'
    ? supplier.openingBalance
    : -supplier.openingBalance;

  const totalPurchase = useMemo(() =>
    transactions.reduce((s, t) => s + t.purchaseAmount, 0), [transactions]);
  const totalPaid = useMemo(() =>
    transactions.reduce((s, t) => s + t.paymentMade, 0), [transactions]);
  const currentBalance = openingBalance + totalPurchase - totalPaid;

  // Analytics
  const purchaseTxns = useMemo(() =>
    transactions.filter(t => t.purchaseAmount > 0), [transactions]);
  const lastPurchase = purchaseTxns.length > 0
    ? purchaseTxns[purchaseTxns.length - 1]
    : null;
  const avgPurchase = purchaseTxns.length > 0
    ? totalPurchase / purchaseTxns.length
    : 0;
  const maxPurchase = purchaseTxns.length > 0
    ? Math.max(...purchaseTxns.map(t => t.purchaseAmount))
    : 0;

  const refreshTransactions = () => setRefreshKey(k => k + 1);

  const handleSavePurchase = () => {
    if (!purchaseDescription.trim()) {
      alert('Please enter a description');
      return;
    }
    if (purchaseAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const txns = storage.getSupplierTransactionsBySupplierId(supplier.id);
    const prevBalance = txns.length > 0 ? txns[txns.length - 1].runningBalance : openingBalance;
    const isReturn = purchaseType === 'purchase_return' || purchaseType === 'credit_note';

    const txn: SupplierTransaction = {
      id: generateId(),
      supplierId: supplier.id,
      date: purchaseDate,
      type: purchaseType,
      referenceNumber: purchaseRef || undefined,
      description: purchaseDescription,
      purchaseAmount: isReturn ? 0 : purchaseAmount,
      paymentMade: isReturn ? purchaseAmount : 0,
      runningBalance: prevBalance + (isReturn ? -purchaseAmount : purchaseAmount),
      notes: purchaseNotes || undefined,
      createdAt: new Date().toISOString(),
    };

    storage.saveSupplierTransaction(txn);
    storage.recalculateSupplierBalance(supplier.id);

    // Reset form
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseDescription('');
    setPurchaseAmount(0);
    setPurchaseRef('');
    setPurchaseNotes('');
    setPurchaseType('purchase_entry');
    setModal(null);
    refreshTransactions();
  };

  const handleSavePayment = () => {
    if (paymentAmount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    const txns = storage.getSupplierTransactionsBySupplierId(supplier.id);
    const prevBalance = txns.length > 0 ? txns[txns.length - 1].runningBalance : openingBalance;

    const txn: SupplierTransaction = {
      id: generateId(),
      supplierId: supplier.id,
      date: paymentDate,
      type: 'payment_made',
      referenceNumber: paymentRef || undefined,
      description: `Payment via ${PAYMENT_METHOD_LABELS[paymentMethod]}`,
      purchaseAmount: 0,
      paymentMade: paymentAmount,
      paymentMethod,
      runningBalance: prevBalance - paymentAmount,
      notes: paymentNotes || undefined,
      createdAt: new Date().toISOString(),
    };

    storage.saveSupplierTransaction(txn);
    storage.recalculateSupplierBalance(supplier.id);

    // Reset form
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentAmount(0);
    setPaymentMethod('cash');
    setPaymentRef('');
    setPaymentNotes('');
    setModal(null);
    refreshTransactions();
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this transaction entry?')) {
      storage.deleteSupplierTransaction(id);
      storage.recalculateSupplierBalance(supplier.id);
      refreshTransactions();
    }
  };

  // Ledger rows with running balance calculated fresh
  const ledgerRows = useMemo(() => {
    let balance = openingBalance;
    return transactions.map(t => {
      balance += t.purchaseAmount - t.paymentMade;
      return { ...t, runningBalance: balance };
    });
  }, [transactions, openingBalance]);

  const isOwed = currentBalance > 0;

  return (
    <div className="space-y-5">
      {/* Back + Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(supplier)}
            className="px-3 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors text-sm"
          >
            Edit Supplier
          </button>
          <button
            onClick={() => setModal('purchase')}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
          <button
            onClick={() => setModal('payment')}
            className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Supplier Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              {supplier.firmName}
            </h2>
            {supplier.contactPerson && (
              <p className="text-slate-500 text-sm mt-0.5">{supplier.contactPerson}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
              {supplier.mobile && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.mobile}
                </span>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.email}
                </span>
              )}
              {supplier.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.address}
                </span>
              )}
              {supplier.gstNumber && (
                <span className="flex items-center gap-1.5 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                  GST: {supplier.gstNumber}
                </span>
              )}
              {supplier.paymentTerms && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {supplier.paymentTerms}
                </span>
              )}
            </div>
          </div>
          {supplier.notes && (
            <p className="text-xs text-slate-500 italic max-w-xs">{supplier.notes}</p>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Purchases</p>
          <p className="text-xl font-bold text-slate-800">Rs. {(openingBalance + totalPurchase - Math.max(0, openingBalance - totalPaid)).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-0.5">{purchaseTxns.length} entries</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-xl font-bold text-emerald-700">Rs. {totalPaid.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${isOwed ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <p className={`text-xs uppercase tracking-wide mb-1 ${isOwed ? 'text-amber-600' : 'text-emerald-600'}`}>
            Amount Payable
          </p>
          <p className={`text-xl font-bold ${isOwed ? 'text-amber-800' : 'text-emerald-800'}`}>
            {isOwed
              ? `Rs. ${currentBalance.toLocaleString()}`
              : currentBalance === 0
                ? 'Clear'
                : `Rs. ${Math.abs(currentBalance).toLocaleString()} Advance`
            }
          </p>
          <p className={`text-xs mt-0.5 ${isOwed ? 'text-amber-600' : 'text-emerald-600'}`}>
            {isOwed ? 'Outstanding due' : currentBalance === 0 ? 'Fully settled' : 'In credit'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Last Purchase</p>
          {lastPurchase ? (
            <>
              <p className="text-base font-bold text-slate-800">{formatDate(lastPurchase.date)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Rs. {lastPurchase.purchaseAmount.toLocaleString()}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">No purchases yet</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Avg. Purchase</p>
          <p className="text-base font-bold text-slate-700">
            Rs. {avgPurchase ? Math.round(avgPurchase).toLocaleString() : '0'}
          </p>
          {maxPurchase > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">Max: Rs. {maxPurchase.toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Transaction History
          </h3>
          <span className="text-xs text-slate-400">{transactions.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Ref No.</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Purchase</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Payment</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Balance</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              {supplier.openingBalance > 0 && (
                <tr className="border-b border-slate-100 bg-blue-50/50">
                  <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(supplier.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Opening Balance
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    {supplier.openingBalanceType === 'to_pay' ? 'Balance to pay supplier' : 'Advance paid to supplier'}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-slate-400">-</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 text-xs">
                    {supplier.openingBalanceType === 'to_pay'
                      ? `Rs. ${supplier.openingBalance.toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 text-xs">
                    {supplier.openingBalanceType === 'advance_paid'
                      ? `Rs. ${supplier.openingBalance.toLocaleString()}`
                      : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-xs text-slate-700">
                    Rs. {openingBalance.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5"></td>
                </tr>
              )}

              {ledgerRows.map((txn, idx) => {
                const isPayment = txn.paymentMade > 0;
                const isCredit = txn.type === 'credit_note' || txn.type === 'purchase_return';
                return (
                  <tr key={txn.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(txn.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isPayment || isCredit
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {TRANSACTION_TYPE_LABELS[txn.type]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 text-xs">
                      <div>{txn.description}</div>
                      {txn.notes && <div className="text-slate-400 mt-0.5">{txn.notes}</div>}
                      {txn.paymentMethod && (
                        <div className="text-slate-400 mt-0.5">{PAYMENT_METHOD_LABELS[txn.paymentMethod]}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs font-mono text-slate-500">
                      {txn.referenceNumber || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {txn.purchaseAmount > 0 ? (
                        <span className="font-medium text-slate-800">Rs. {txn.purchaseAmount.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {txn.paymentMade > 0 ? (
                        <span className="font-medium text-emerald-700">Rs. {txn.paymentMade.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs font-bold ${txn.runningBalance > 0 ? 'text-amber-700' : txn.runningBalance < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                        Rs. {Math.abs(txn.runningBalance).toLocaleString()}
                        {txn.runningBalance < 0 && <span className="text-xs font-normal ml-1">(Adv)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => handleDeleteTransaction(txn.id)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete entry"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No transactions yet. Add a purchase or payment entry to begin.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Balance Footer */}
            {(transactions.length > 0 || supplier.openingBalance > 0) && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-700">
                    Closing Balance
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700 text-sm">
                    Rs. {(openingBalance + totalPurchase).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 text-sm">
                    Rs. {totalPaid.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-bold ${isOwed ? 'text-amber-800' : 'text-emerald-700'}`}>
                      Rs. {Math.abs(currentBalance).toLocaleString()}
                      {!isOwed && currentBalance !== 0 && <span className="text-xs font-normal ml-1">(Adv)</span>}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Purchase Entry Modal */}
      {modal === 'purchase' && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Add Purchase Entry
              </h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Type</label>
                  <select
                    value={purchaseType}
                    onChange={e => setPurchaseType(e.target.value as SupplierTransactionType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="purchase_entry">Purchase Entry</option>
                    <option value="purchase_return">Purchase Return</option>
                    <option value="debit_note">Debit Note</option>
                    <option value="credit_note">Credit Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description / Item *</label>
                <input
                  type="text"
                  value={purchaseDescription}
                  onChange={e => setPurchaseDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Cement 50 bags, Solar Panel 10 pcs"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Amount (Rs.) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseAmount || ''}
                    onChange={e => setPurchaseAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reference / Bill No.</label>
                  <input
                    type="text"
                    value={purchaseRef}
                    onChange={e => setPurchaseRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                    placeholder="Bill / Invoice no."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={purchaseNotes}
                  onChange={e => setPurchaseNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 text-sm">
                Cancel
              </button>
              <button onClick={handleSavePurchase} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" />
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Entry Modal */}
      {modal === 'payment' && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Record Payment
              </h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Outstanding indicator */}
            {isOwed && (
              <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800">
                  Outstanding balance: <strong>Rs. {currentBalance.toLocaleString()}</strong>
                </span>
              </div>
            )}

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Amount Paid (Rs.) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'upi', 'bank_transfer', 'cheque'] as SupplierPaymentMethod[]).map(m => (
                    <label key={m} className={`flex items-center gap-2 p-2.5 border rounded-md cursor-pointer transition-colors ${
                      paymentMethod === m
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        value={m}
                        checked={paymentMethod === m}
                        onChange={() => setPaymentMethod(m)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm font-medium">{PAYMENT_METHOD_LABELS[m]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={e => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    placeholder="UTR / Cheque no."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Optional notes"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 text-sm">
                Cancel
              </button>
              <button onClick={handleSavePayment} className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
