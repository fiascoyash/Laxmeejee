import { Customer, ShipTo, TemplateField } from '../types';
import { User, MapPin, Phone, MapPinned, Truck, Copy } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Props {
  customer: Customer;
  onChange: (customer: Customer) => void;
  shipTo?: ShipTo;
  onShipToChange?: (shipTo: ShipTo) => void;
  // NEW: Custom fields from template schema
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

  const actualShipTo = shipTo || createEmptyShipTo();

  useEffect(() => {
    if (sameAsBillTo && onShipToChange) {
      onShipToChange(createShipToFromCustomer(customer));
    }
  }, [customer, sameAsBillTo, onShipToChange]);

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

    // Default: text
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bill To Section */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Bill To
          </h3>
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-4 h-4" /> Mobile
              </label>
              <input
                type="tel"
                value={customer.mobile}
                onChange={(e) => onChange({ ...customer, mobile: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="10-digit mobile number"
              />
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
