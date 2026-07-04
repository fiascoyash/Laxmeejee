import React from 'react';
import { TrendingUp, IndianRupee, FileText, Receipt, Calculator, Percent } from 'lucide-react';
import { GstDashboardData } from '../../utils/gstReports';

interface GstDashboardProps {
  data: GstDashboardData;
}

export const GstDashboard: React.FC<GstDashboardProps> = ({ data }) => {
  const cards = [
    {
      title: 'Taxable Sales',
      value: data.taxableSales,
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-600',
      borderColor: 'border-blue-200',
    },
    {
      title: 'CGST Collected',
      value: data.cgst,
      icon: IndianRupee,
      color: 'bg-emerald-50 text-emerald-600',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'SGST Collected',
      value: data.sgst,
      icon: IndianRupee,
      color: 'bg-teal-50 text-teal-600',
      borderColor: 'border-teal-200',
    },
    {
      title: 'IGST Collected',
      value: data.igst,
      icon: IndianRupee,
      color: 'bg-purple-50 text-purple-600',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Tax Free Sales',
      value: data.taxFreeSales,
      icon: Percent,
      color: 'bg-amber-50 text-amber-600',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Total GST Collected',
      value: data.totalGstCollected,
      icon: Calculator,
      color: 'bg-green-50 text-green-600',
      borderColor: 'border-green-200',
      highlight: true,
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl shadow-sm border ${card.borderColor} p-6 hover:shadow-md transition-all ${
              card.highlight ? 'ring-2 ring-green-400' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{card.title}</p>
                <p className={`text-2xl font-bold mt-1 ${card.highlight ? 'text-green-600' : 'text-slate-800'}`}>
                  {formatCurrency(card.value)}
                </p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice Count Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Invoices</p>
              <p className="text-3xl font-bold text-slate-800">{data.totalInvoices}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Average GST per Invoice</p>
            <p className="text-xl font-semibold text-slate-800">
              {formatCurrency(data.totalInvoices > 0 ? data.totalGstCollected / data.totalInvoices : 0)}
            </p>
          </div>
        </div>
      </div>

      {/* GST Breakdown Visual */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">GST Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(data.cgst / (data.totalGstCollected || 1)) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-600">CGST</span>
              </div>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(data.cgst)}</p>
            <p className="text-xs text-slate-500">
              {data.totalGstCollected > 0 ? ((data.cgst / data.totalGstCollected) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#14b8a6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(data.sgst / (data.totalGstCollected || 1)) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-600">SGST</span>
              </div>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(data.sgst)}</p>
            <p className="text-xs text-slate-500">
              {data.totalGstCollected > 0 ? ((data.sgst / data.totalGstCollected) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="text-center">
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#8b5cf6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(data.igst / (data.totalGstCollected || 1)) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-600">IGST</span>
              </div>
            </div>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(data.igst)}</p>
            <p className="text-xs text-slate-500">
              {data.totalGstCollected > 0 ? ((data.igst / data.totalGstCollected) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
