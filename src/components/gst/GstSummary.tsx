import React from 'react';
import { GstRateSummary, formatCurrency } from '../../utils/gstReports';

interface GstSummaryProps {
  data: GstRateSummary[];
}

export const GstSummary: React.FC<GstSummaryProps> = ({ data }) => {
  const totals = data.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      igst: acc.igst + row.igst,
      totalGst: acc.totalGst + row.totalGst,
      invoiceCount: acc.invoiceCount + row.invoiceCount,
    }),
    { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, invoiceCount: 0 }
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                GST Rate
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Taxable Value
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
                Total GST
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Invoices
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    row.gstRate === 0
                      ? 'bg-gray-100 text-gray-700'
                      : row.gstRate <= 5
                      ? 'bg-green-100 text-green-700'
                      : row.gstRate <= 12
                      ? 'bg-blue-100 text-blue-700'
                      : row.gstRate <= 18
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {row.gstRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatCurrency(row.taxableValue)}
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
                  {formatCurrency(row.totalGst)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {row.invoiceCount}
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-slate-100 font-semibold">
              <td className="px-4 py-3 text-slate-800">Total</td>
              <td className="px-4 py-3 text-right text-slate-800 font-bold">
                {formatCurrency(totals.taxableValue)}
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
                {formatCurrency(totals.totalGst)}
              </td>
              <td className="px-4 py-3 text-right text-slate-800">
                {totals.invoiceCount}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
