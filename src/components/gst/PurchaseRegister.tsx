import React from 'react';
import { PurchaseRegisterEntry, formatCurrency } from '../../utils/gstReports';

interface PurchaseRegisterProps {
  data: PurchaseRegisterEntry[];
}

export const PurchaseRegister: React.FC<PurchaseRegisterProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No purchase data available. Import purchases using the Smart Purchase Import feature.</p>
      </div>
    );
  }

  const totals = data.reduce(
    (acc, row) => ({
      gst: acc.gst + row.gst,
      tax: acc.tax + row.tax,
      total: acc.total + row.total,
    }),
    { gst: 0, tax: 0, total: 0 }
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Purchase No
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Tax Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                GST
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-800 font-medium">
                  {row.vendorName}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-sm">
                    {row.purchaseNo}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatCurrency(row.tax)}
                </td>
                <td className="px-4 py-3 text-right text-orange-600 font-medium">
                  {formatCurrency(row.gst)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {formatCurrency(row.total)}
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-slate-100 font-semibold">
              <td className="px-4 py-3 text-slate-800" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right text-slate-800 font-bold">
                {formatCurrency(totals.tax)}
              </td>
              <td className="px-4 py-3 text-right text-orange-600 font-bold">
                {formatCurrency(totals.gst)}
              </td>
              <td className="px-4 py-3 text-right text-slate-900 font-bold">
                {formatCurrency(totals.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
