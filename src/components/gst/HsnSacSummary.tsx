import React from 'react';
import { HsnSacSummary as HsnSacSummaryType, formatCurrency } from '../../utils/gstReports';

interface HsnSacSummaryProps {
  data: HsnSacSummaryType[];
}

export const HsnSacSummary: React.FC<HsnSacSummaryProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-500">No HSN/SAC data available for the selected period.</p>
      </div>
    );
  }

  const totals = data.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      gstAmount: acc.gstAmount + row.gstAmount,
      invoiceCount: Math.max(acc.invoiceCount, row.invoiceCount),
    }),
    { taxableValue: 0, gstAmount: 0, invoiceCount: 0 }
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                HSN/SAC Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Taxable Value
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                GST Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Invoice Count
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 text-blue-700 font-mono text-sm font-semibold">
                    {row.hsnSacCode}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={row.description}>
                  {row.description}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">
                  {formatCurrency(row.taxableValue)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                  {formatCurrency(row.gstAmount)}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {row.invoiceCount}
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-slate-100 font-semibold">
              <td className="px-4 py-3 text-slate-800" colSpan={2}>Total</td>
              <td className="px-4 py-3 text-right text-slate-800 font-bold">
                {formatCurrency(totals.taxableValue)}
              </td>
              <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                {formatCurrency(totals.gstAmount)}
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
