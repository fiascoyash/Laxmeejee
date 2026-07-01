import { useState, useEffect } from 'react';
import { SupplierData, SupplierBalanceType, PAYMENT_TERMS_OPTIONS } from '../types';
import { generateId } from '../utils/storage';
import { X, Save, Truck } from 'lucide-react';

interface Props {
  supplier: SupplierData | null;
  onSave: (supplier: SupplierData) => void;
  onCancel: () => void;
}

const emptySupplier = (): Omit<SupplierData, 'id' | 'createdAt' | 'updatedAt'> => ({
  firmName: '',
  contactPerson: '',
  mobile: '',
  email: '',
  gstNumber: '',
  address: '',
  openingBalance: 0,
  openingBalanceType: 'to_pay',
  paymentTerms: '',
  notes: '',
});

export function SupplierForm({ supplier, onSave, onCancel }: Props) {
  const [form, setForm] = useState(supplier
    ? { ...supplier }
    : { ...emptySupplier(), id: '', createdAt: '', updatedAt: '' }
  );
  const [customTerms, setCustomTerms] = useState('');
  const [showCustomTerms, setShowCustomTerms] = useState(false);

  useEffect(() => {
    if (supplier) {
      setForm({ ...supplier });
      const isCustom = supplier.paymentTerms &&
        !PAYMENT_TERMS_OPTIONS.includes(supplier.paymentTerms) &&
        supplier.paymentTerms !== '';
      if (isCustom) {
        setShowCustomTerms(true);
        setCustomTerms(supplier.paymentTerms || '');
      }
    }
  }, [supplier]);

  const update = <K extends keyof SupplierData>(key: K, value: SupplierData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!form.firmName.trim()) {
      alert('Please enter firm / company name');
      return;
    }
    const now = new Date().toISOString();
    const finalTerms = showCustomTerms ? customTerms : form.paymentTerms;
    const toSave: SupplierData = {
      ...form,
      id: form.id || generateId(),
      firmName: form.firmName.trim(),
      paymentTerms: finalTerms,
      createdAt: form.createdAt || now,
      updatedAt: now,
    };
    onSave(toSave);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 rounded-t-xl sticky top-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
          {/* Firm Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Firm / Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.firmName}
              onChange={e => update('firmName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g., Ambuja Cement Agency"
              autoFocus
            />
          </div>

          {/* Contact + Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={form.contactPerson || ''}
                onChange={e => update('contactPerson', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., Ramesh Kumar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                value={form.mobile || ''}
                onChange={e => update('mobile', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="10-digit mobile"
              />
            </div>
          </div>

          {/* Email + GST */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={e => update('email', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="supplier@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GST Number</label>
              <input
                type="text"
                value={form.gstNumber || ''}
                onChange={e => update('gstNumber', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="GSTIN"
                maxLength={15}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <textarea
              value={form.address || ''}
              onChange={e => update('address', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={2}
              placeholder="Full address"
            />
          </div>

          {/* Opening Balance */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Opening Balance</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opening Balance (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={e => update('openingBalance', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Balance Type</label>
                <select
                  value={form.openingBalanceType}
                  onChange={e => update('openingBalanceType', e.target.value as SupplierBalanceType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="to_pay">To Pay (Dena Hai)</option>
                  <option value="advance_paid">Advance Paid (Diya Hua)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
            <select
              value={showCustomTerms ? 'Custom' : (form.paymentTerms || '')}
              onChange={e => {
                if (e.target.value === 'Custom') {
                  setShowCustomTerms(true);
                } else {
                  setShowCustomTerms(false);
                  update('paymentTerms', e.target.value);
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="">Select payment terms</option>
              {PAYMENT_TERMS_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {showCustomTerms && (
              <input
                type="text"
                value={customTerms}
                onChange={e => setCustomTerms(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter custom payment terms"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes || ''}
              onChange={e => update('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={2}
              placeholder="Additional notes about this supplier..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl sticky bottom-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            {supplier ? 'Update Supplier' : 'Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
}
