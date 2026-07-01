import { useState, useMemo } from 'react';
import { SupplierData, SupplierTransaction } from '../types';
import { storage } from '../utils/storage';
import { Search, Plus, Trash2, Edit, Eye, Truck, Phone, MapPin, AlertCircle } from 'lucide-react';

interface Props {
  suppliers: SupplierData[];
  onView: (supplier: SupplierData) => void;
  onEdit: (supplier: SupplierData) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

function getSupplierStats(supplier: SupplierData, transactions: SupplierTransaction[]) {
  const txns = transactions.filter(t => t.supplierId === supplier.id);

  const openingBalance = supplier.openingBalanceType === 'to_pay'
    ? supplier.openingBalance
    : -supplier.openingBalance;

  const totalPurchase = txns.reduce((sum, t) => sum + t.purchaseAmount, 0);
  const totalPaid = txns.reduce((sum, t) => sum + t.paymentMade, 0);
  const balance = openingBalance + totalPurchase - totalPaid;

  const purchaseTxns = txns.filter(t => t.purchaseAmount > 0).sort((a, b) => b.date.localeCompare(a.date));
  const lastPurchaseDate = purchaseTxns[0]?.date || null;
  const lastPurchaseAmount = purchaseTxns[0]?.purchaseAmount || 0;

  return { totalPurchase, totalPaid, balance, lastPurchaseDate, lastPurchaseAmount };
}

export function SupplierList({ suppliers, onView, onEdit, onDelete, onAdd }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'outstanding' | 'paid'>('all');

  const allTransactions = useMemo(() => storage.getSupplierTransactions(), [suppliers]);

  const filteredSuppliers = useMemo(() => {
    let list = [...suppliers];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.firmName.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.mobile && s.mobile.includes(q)) ||
        (s.gstNumber && s.gstNumber.toLowerCase().includes(q))
      );
    }

    if (filterType === 'outstanding') {
      list = list.filter(s => {
        const { balance } = getSupplierStats(s, allTransactions);
        return balance > 0;
      });
    } else if (filterType === 'paid') {
      list = list.filter(s => {
        const { balance } = getSupplierStats(s, allTransactions);
        return balance <= 0;
      });
    }

    return list;
  }, [suppliers, searchQuery, filterType, allTransactions]);

  const totalPayable = useMemo(() => {
    return suppliers.reduce((sum, s) => {
      const { balance } = getSupplierStats(s, allTransactions);
      return sum + Math.max(0, balance);
    }, 0);
  }, [suppliers, allTransactions]);

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      {suppliers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Suppliers</p>
            <p className="text-2xl font-bold text-slate-800">{suppliers.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Outstanding Vendors</p>
            <p className="text-2xl font-bold text-amber-700">
              {suppliers.filter(s => getSupplierStats(s, allTransactions).balance > 0).length}
            </p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Total Amount Payable</p>
            <p className="text-2xl font-bold text-amber-800">Rs. {totalPayable.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Search + Filter + Add */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, mobile, GST..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'outstanding', 'paid'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors capitalize ${
                    filterType === f
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'outstanding' ? 'Outstanding' : f === 'paid' ? 'Fully Paid' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Supplier / Firm</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Mobile</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Purchase</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Total Paid</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount Payable</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700">Last Purchase</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map(supplier => {
                const { totalPurchase, totalPaid, balance, lastPurchaseDate } = getSupplierStats(supplier, allTransactions);
                const isOwed = balance > 0;
                return (
                  <tr key={supplier.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onView(supplier)}
                        className="text-left group"
                      >
                        <div className="font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                          {supplier.firmName}
                        </div>
                        {supplier.contactPerson && (
                          <div className="text-xs text-slate-500 mt-0.5">{supplier.contactPerson}</div>
                        )}
                        {supplier.gstNumber && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{supplier.gstNumber}</div>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {supplier.mobile ? (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Phone className="w-3 h-3" />
                          {supplier.mobile}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      Rs. {totalPurchase.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">
                      Rs. {totalPaid.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${isOwed ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {isOwed ? (
                          <span className="flex items-center justify-end gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Rs. {balance.toLocaleString()}
                          </span>
                        ) : (
                          <span>Rs. {Math.abs(balance).toLocaleString()} {balance < 0 ? '(Advance)' : '(Clear)'}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {lastPurchaseDate
                        ? new Date(lastPurchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onView(supplier)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Ledger"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(supplier)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete supplier "${supplier.firmName}"? This will also delete all transaction history.`)) {
                              onDelete(supplier.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">
                      {suppliers.length === 0
                        ? 'No suppliers added yet.'
                        : 'No suppliers match your search.'}
                    </p>
                    {suppliers.length === 0 && (
                      <button
                        onClick={onAdd}
                        className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm"
                      >
                        Add First Supplier
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
