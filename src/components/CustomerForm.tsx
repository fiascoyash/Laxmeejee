import { CustomerData } from '../types';
import { X, Save } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeMobile, sanitizeGstin, isValidMobile, isValidGstin } from '../utils/validation';

interface Props {
  customer: CustomerData | null;
  onSave: (customer: CustomerData) => void;
  onCancel: () => void;
  isExistingCustomer?: boolean;
}

export function CustomerForm({ customer, onSave, onCancel, isExistingCustomer }: Props) {
  const [formData, setFormData] = useState<Omit<CustomerData, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    mobile: '',
    gstNumber: '',
    email: '',
    village: '',
    district: '',
    billingAddress: '',
    deliveryAddress: '',
    notes: '',
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Field navigation with Enter/Shift+Enter
  const FIELD_IDS = ['name', 'mobile', 'gstNumber', 'email', 'village', 'district', 'billingAddress', 'deliveryAddress', 'notes'];

  const handleFieldKeyDown = useCallback((e: React.KeyboardEvent, currentFieldId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currentIndex = FIELD_IDS.indexOf(currentFieldId);
      if (currentIndex >= 0 && currentIndex < FIELD_IDS.length - 1) {
        const nextField = formRef.current?.querySelector(`[data-field-id="${FIELD_IDS[currentIndex + 1]}"] input, [data-field-id="${FIELD_IDS[currentIndex + 1]}"] textarea`) as HTMLElement;
        nextField?.focus();
      }
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const currentIndex = FIELD_IDS.indexOf(currentFieldId);
      if (currentIndex > 0) {
        const prevField = formRef.current?.querySelector(`[data-field-id="${FIELD_IDS[currentIndex - 1]}"] input, [data-field-id="${FIELD_IDS[currentIndex - 1]}"] textarea`) as HTMLElement;
        prevField?.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        mobile: customer.mobile,
        gstNumber: customer.gstNumber || '',
        email: customer.email || '',
        village: customer.village,
        district: customer.district,
        billingAddress: customer.billingAddress,
        deliveryAddress: customer.deliveryAddress || '',
        notes: customer.notes || '',
      });
    }
  }, [customer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) {
      alert('Name and Mobile are required');
      return;
    }
    if (!isValidMobile(formData.mobile)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    if (formData.gstNumber && !isValidGstin(formData.gstNumber)) {
      alert('Please enter a valid 15-character GSTIN or leave it blank');
      return;
    }
    const now = new Date().toISOString();
    const customerData: CustomerData = {
      id: customer?.id || '',
      ...formData,
      createdAt: customer?.createdAt || now,
      updatedAt: now,
    };
    onSave(customerData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">
            {customer ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {isExistingCustomer && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              A customer with this mobile number already exists. You can update their details.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div data-field-id="name">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={(e) => handleFieldKeyDown(e, 'name')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter customer name"
                required
                autoFocus
              />
            </div>
            <div data-field-id="mobile">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: sanitizeMobile(e.target.value) })}
                onKeyDown={(e) => handleFieldKeyDown(e, 'mobile')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="10-digit mobile number"
                maxLength={10}
                required
              />
              {formData.mobile && !isValidMobile(formData.mobile) && (
                <p className="text-xs text-red-500 mt-1">Mobile number must be exactly 10 digits</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div data-field-id="gstNumber">
              <label className="block text-sm font-medium text-slate-700 mb-1">GST Number (Optional)</label>
              <input
                type="text"
                value={formData.gstNumber || ''}
                onChange={(e) => setFormData({ ...formData, gstNumber: sanitizeGstin(e.target.value) })}
                onKeyDown={(e) => handleFieldKeyDown(e, 'gstNumber')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono uppercase"
                placeholder="GSTIN number"
                maxLength={15}
              />
              {formData.gstNumber && !isValidGstin(formData.gstNumber) && (
                <p className="text-xs text-red-500 mt-1">Invalid GSTIN format (15 chars, state code + PAN + Z + checksum)</p>
              )}
            </div>
            <div data-field-id="email">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onKeyDown={(e) => handleFieldKeyDown(e, 'email')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Email address"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div data-field-id="village">
              <label className="block text-sm font-medium text-slate-700 mb-1">Village/Town</label>
              <input
                type="text"
                value={formData.village}
                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                onKeyDown={(e) => handleFieldKeyDown(e, 'village')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Village or town name"
              />
            </div>
            <div data-field-id="district">
              <label className="block text-sm font-medium text-slate-700 mb-1">District</label>
              <input
                type="text"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                onKeyDown={(e) => handleFieldKeyDown(e, 'district')}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="District name"
              />
            </div>
          </div>
          <div data-field-id="billingAddress">
            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Address</label>
            <textarea
              value={formData.billingAddress}
              onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
              onKeyDown={(e) => handleFieldKeyDown(e, 'billingAddress')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={2}
              placeholder="Full billing address with pincode"
            />
          </div>
          <div data-field-id="deliveryAddress">
            <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address (Optional)</label>
            <textarea
              value={formData.deliveryAddress || ''}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              onKeyDown={(e) => handleFieldKeyDown(e, 'deliveryAddress')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={2}
              placeholder="Delivery address if different from billing"
            />
          </div>
          <div data-field-id="notes">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              onKeyDown={(e) => handleFieldKeyDown(e, 'notes')}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              rows={2}
              placeholder="Additional notes about this customer"
            />
          </div>
        </form>
        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Customer
          </button>
        </div>
      </div>
    </div>
  );
}
