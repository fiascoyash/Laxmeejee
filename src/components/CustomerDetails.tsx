import { Customer, ShipTo, TemplateField, CustomerData } from '../types';
import { User, MapPin, Phone, MapPinned, Truck, Copy, Save, Clock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { storage, generateId } from '../utils/storage';

interface Props {
  customer: Customer;
  onChange: (customer: Customer) => void;
  shipTo?: ShipTo;
  onShipToChange?: (shipTo: ShipTo) => void;
  customFields?: TemplateField[];
}

const createEmptyShipTo = (): ShipTo => ({
  name: '',
  address: '',
  mobile: '',
  gstNumber: '',
});

const createShipToFromCustomer = (customer: Customer): ShipTo => ({
  name: customer.name,
  address: [customer.billingAddress, customer.village, customer.district].filter(Boolean).join(', '),
  mobile: customer.mobile,
  gstNumber: customer.gstNumber || '',
});

export function CustomerDetails({ customer, onChange, shipTo, onShipToChange, customFields = [] }: Props) {
  const [sameAsBillTo, setSameAsBillTo] = useState(true);
  const [suggestions, setSuggestions] = useState<CustomerData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState<CustomerData[]>([]);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const actualShipTo = shipTo || createEmptyShipTo();

  // Load recent customers on mount
  useEffect(() => {
    setRecentCustomers(storage.getRecentCustomers(5));
  }, []);

  // Auto-detect customer by mobile number
  useEffect(() => {
    if (customer.mobile.length >= 4) {
      const matched = storage.searchCustomers(customer.mobile);
      setSuggestions(matched.slice(0, 5));
      setShowSuggestions(matched.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [customer.mobile]);

  // Check if should show save button
  useEffect(() => {
    const hasData = customer.name && customer.mobile && customer.mobile.length >= 10;
    const exists = storage.isCustomerExists(customer.mobile);
    setShowSaveButton(hasData && !exists);
  }, [customer.name, customer.mobile]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSameAsBillToChange = (checked: boolean) => {
    setSameAsBillTo(checked);
    if (checked && onShipToChange) {
      onShipToChange(createShipToFromCustomer(customer));
    }
  };

  const handleShipToChange = (field: keyof ShipTo, value: string) => {
    if (onShipToChange) {
      onShipToChange({ ...actualShipTo, [field]: value });
    }
  };

  // Auto-fill customer details from selection
  const handleSelectCustomer = (customerData: CustomerData) => {
    onChange({
      name: customerData.name,
      mobile: customerData.mobile,
      gstNumber: customerData.gstNumber || '',
      billingAddress: customerData.billingAddress,
      village: customerData.village,
      district: customerData.district,
      customFields: customer.customFields,
    });
    setShowSuggestions(false);
    // Update Ship To if enabled
    if (sameAsBillTo && onShipToChange) {
      const deliveryAddress = customerData.deliveryAddress || [customerData.billingAddress, customerData.village, customerData.district].filter(Boolean).join(', ');
      onShipToChange({
        name: customerData.name,
        address: deliveryAddress,
        mobile: customerData.mobile,
        gstNumber: customerData.gstNumber || '',
      });
    }
  };

  // Select from recent customers
  const handleSelectRecent = (customerData: CustomerData) => {
    handleSelectCustomer(customerData);
  };

  // Save customer directly from quotation page
  const handleSaveCustomer = () => {
    if (!customer.name || !customer.mobile) {
      alert('Please enter customer name and mobile number');
      return;
    }
    if (storage.isCustomerExists(customer.mobile)) {
      alert('Customer with this mobile number already exists');
      return;
    }
    const now = new Date().toISOString();
    const newCustomer: CustomerData = {
      id: generateId(),
      name: customer.name,
      mobile: customer.mobile,
      gstNumber: customer.gstNumber || '',
      village: customer.village,
      district: customer.district,
      billingAddress: customer.billingAddress,
      deliveryAddress: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    storage.saveCustomer(newCustomer);
    setRecentCustomers(storage.getRecentCustomers(5));
    setShowSaveButton(false);
    alert('Customer saved successfully!');
  };

  const updateCustomField = (fieldKey: string, value: string | number | boolean) => {
    onChange({
      ...customer,
      customFields: { ...customer.customFields, [fieldKey]: value }
    });
  };

  const renderCustomField = (field: TemplateField) => {
    const value = customer.customFields?.[field.key] ?? field.defaultValue ?? '';

    if (field.type === 'select' && field.options) {
      return (
        <select
          value={value as string}
          onChange={(e) => updateCustomField(field.key, e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">Select {field.label}...</option>
          {field.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={value as string}
          onChange={(e) => updateCustomField(field.key, e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          rows={2}
          placeholder={field.placeholder}
        />
      );
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={value as string}
          onChange={(e) => updateCustomField(field.key, e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          value={value as number}
          onChange={(e) => updateCustomField(field.key, Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          placeholder={field.placeholder}
        />
      );
    }

    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => updateCustomField(field.key, e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      {/* Recent Customers Quick Select */}
      {recentCustomers.length > 0 && !customer.name && (
        <div className="mb-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-2 text-sm text-slate-600">
            <Clock className="w-4 h-4" />
            <span>Recent Customers:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentCustomers.map(rc => (
              <button
                key={rc.id}
                onClick={() => handleSelectRecent(rc)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm transition-colors"
              >
                {rc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bill To Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Bill To
            </h3>
            {showSaveButton && (
              <button
                onClick={handleSaveCustomer}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-md text-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Customer
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customer.name}
                onChange={(e) => onChange({ ...customer, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter customer name"
                required
              />
            </div>
            <div className="relative" ref={suggestionsRef}>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-4 h-4" /> Mobile
              </label>
              <input
                type="tel"
                value={customer.mobile}
                onChange={(e) => onChange({ ...customer, mobile: e.target.value })}
                onFocus={() => {
                  if (customer.mobile.length >= 4 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="10-digit mobile number"
              />
              {/* Customer Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectCustomer(s)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="font-medium text-slate-800">{s.name}</div>
                      <div className="text-xs text-slate-500">
                        {s.mobile} {s.district && `| ${s.district}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GST Number (Optional)</label>
              <input
                type="text"
                value={customer.gstNumber || ''}
                onChange={(e) => onChange({ ...customer, gstNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="GSTIN number"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <MapPinned className="w-4 h-4" /> Village
                </label>
                <input
                  type="text"
                  value={customer.village}
                  onChange={(e) => onChange({ ...customer, village: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Village/Town"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> District
                </label>
                <input
                  type="text"
                  value={customer.district}
                  onChange={(e) => onChange({ ...customer, district: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="District"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Billing Address</label>
              <textarea
                value={customer.billingAddress}
                onChange={(e) => onChange({ ...customer, billingAddress: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                rows={2}
                placeholder="Full address with pincode"
              />
            </div>

            {/* Custom fields from template schema */}
            {customFields.filter(f => f.location === 'customer').map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderCustomField(field)}
              </div>
            ))}
          </div>
        </div>

        {/* Ship To Section */}
        {onShipToChange && (
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-600" />
              Ship To
            </h3>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sameAsBillTo}
                  onChange={(e) => handleSameAsBillToChange(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 flex items-center gap-1">
                  <Copy className="w-4 h-4" /> Same as Bill To
                </span>
              </label>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Receiver Name</label>
                <input
                  type="text"
                  value={actualShipTo.name}
                  onChange={(e) => handleShipToChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder="Enter receiver name"
                  disabled={sameAsBillTo}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-4 h-4" /> Mobile
                </label>
                <input
                  type="tel"
                  value={actualShipTo.mobile}
                  onChange={(e) => handleShipToChange('mobile', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder="10-digit mobile number"
                  disabled={sameAsBillTo}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">GST Number (Optional)</label>
                <input
                  type="text"
                  value={actualShipTo.gstNumber || ''}
                  onChange={(e) => handleShipToChange('gstNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder="GSTIN number"
                  disabled={sameAsBillTo}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address</label>
                <textarea
                  value={actualShipTo.address}
                  onChange={(e) => handleShipToChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  rows={2}
                  placeholder="Full delivery address with pincode"
                  disabled={sameAsBillTo}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
