import { CustomerData } from '../types';
import { Search, Plus, Eye, Edit2, Trash2, FileText, Receipt } from 'lucide-react';
import { useState } from 'react';

interface Props {
  customers: CustomerData[];
  onView: (customer: CustomerData) => void;
  onEdit: (customer: CustomerData) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  quotationCounts: Record<string, number>;
  invoiceCounts: Record<string, number>;
  lastActivityDates: Record<string, string>;
}

export function CustomerList({
  customers,
  onView,
  onEdit,
  onDelete,
  onAdd,
  quotationCounts,
  invoiceCounts,
  lastActivityDates,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.mobile.includes(searchQuery) ||
      (c.gstNumber && c.gstNumber.toLowerCase().includes(query))
    );
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, mobile, or GST..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <p className="text-slate-600 mb-4">
            {searchQuery ? 'No customers found matching your search' : 'No customers added yet'}
          </p>
          {!searchQuery && (
            <button
              onClick={onAdd}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Add Your First Customer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">GST Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">District</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider hidden xl:table-cell">Quotations</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider hidden xl:table-cell">Invoices</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden xl:table-cell">Last Activity</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{customer.name}</div>
                      <div className="text-xs text-slate-500 md:hidden">{customer.district}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{customer.mobile}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {customer.gstNumber || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{customer.district || '-'}</td>
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-sm">
                        <FileText className="w-3 h-3" />
                        {quotationCounts[customer.mobile] || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-sm">
                        <Receipt className="w-3 h-3" />
                        {invoiceCounts[customer.mobile] || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm hidden xl:table-cell">
                      {lastActivityDates[customer.mobile] || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onView(customer)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEdit(customer)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this customer?')) {
                              onDelete(customer.id);
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
