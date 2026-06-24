import { Customer } from '../types';
import { User, MapPin, Phone, MapPinned } from 'lucide-react';

interface Props {
  customer: Customer;
  onChange: (customer: Customer) => void;
}

export function CustomerDetails({ customer, onChange }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <User className="w-5 h-5 text-blue-600" />
        Customer Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
          <input
            type="text"
            value={customer.name}
            onChange={(e) => onChange({ ...customer, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter customer name"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Phone className="w-4 h-4" /> Mobile
          </label>
          <input
            type="tel"
            value={customer.mobile}
            onChange={(e) => onChange({ ...customer, mobile: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="10-digit mobile number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <MapPinned className="w-4 h-4" /> Village
          </label>
          <input
            type="text"
            value={customer.village}
            onChange={(e) => onChange({ ...customer, village: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Village/Town"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> District
          </label>
          <input
            type="text"
            value={customer.district}
            onChange={(e) => onChange({ ...customer, district: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="District"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
          <textarea
            value={customer.billingAddress}
            onChange={(e) => onChange({ ...customer, billingAddress: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            placeholder="Full address with pincode"
          />
        </div>
      </div>
    </div>
  );
}
