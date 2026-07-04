import React from 'react';
import { SalesRegisterEntry, formatCurrency, formatDate } from '../../utils/gstReports';

interface SalesRegisterProps {
  data: SalesRegisterEntry[];
}

export const SalesRegister: React.FC<SalesRegisterProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No sales data available for the selected period.</p>
      </div>
    );
  }

  const totals = data.reduce(
    (acc, row) => ({
      taxableAmount: acc.taxableAmount + row.taxableAmount,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      igst: acc.igst + row.igst,
      gst: acc.gst + row.gst,
      grandTotal: acc.grandTotal + row.grandTotal,
    }),
    { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, grandTotal: 0 }
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Invoice No
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                GSTIN
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Taxable Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                CGST
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                SGST
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                IGST
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                GST
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Grand Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-600">
                  {formatDate(row.date)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-sm">
                    {row.invoiceNo}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-800 font-medium">
                  {row.customerName}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  {row.customerGstin || '-'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatCurrency(row.taxableAmount)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                  {formatCurrency(row.cgst)}
                </td>
                <td className="px-4 py-3 text-right text-teal-600 font-medium">
                  {formatCurrency(row.sgst)}
                </td>
                <td className="px-4 py-3 text-right text-purple-600 font-medium">
                  {formatCurrency(row.igst)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">
                  {formatCurrency(row.gst)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {formatCurrency(row.grandTotal)}
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-slate-100 font-semibold">
              <td className="px-4 py-3 text-slate-800" colSpan={4}>Total</td>
              <td className="px-4 py-3 text-right text-slate-800 font-bold">
                {formatCurrency(totals.taxableAmount)}
              </td>
              <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                {formatCurrency(totals.cgst)}
              </td>
              <td className="px-4 py-3 text-right text-teal-600 font-bold">
                {formatCurrency(totals.sgst)}
              </td>
              <td className="px-4 py-3 text-right text-purple-600 font-bold">
                {formatCurrency(totals.igst)}
              </td>
              <td className="px-4 py-3 text-right text-slate-800 font-bold">
                {formatCurrency(totals.gst)}
              </td>
              <td className="px-4 py-3 text-right text-slate-900 font-bold">
                {formatCurrency(totals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
