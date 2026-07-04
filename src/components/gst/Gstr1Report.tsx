import React, { useState } from 'react';
import { FileText, Building, ShoppingCart, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Gstr1B2BEntry, Gstr1CreditNoteEntry, formatCurrency, formatDate } from '../../utils/gstReports';

interface Gstr1ReportProps {
  data: {
    b2b: Gstr1B2BEntry[];
    b2c: Gstr1B2BEntry[];
    creditNotes: Gstr1CreditNoteEntry[];
    debitNotes: Gstr1CreditNoteEntry[];
  };
}

export const Gstr1Report: React.FC<Gstr1ReportProps> = ({ data }) => {
  const [activeSection, setActiveSection] = useState<string>('b2b');

  const b2bTotals = data.b2b.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      igst: acc.igst + row.igst,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      totalGst: acc.totalGst + row.totalGst,
    }),
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalGst: 0 }
  );

  const b2cTotals = data.b2c.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      igst: acc.igst + row.igst,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      totalGst: acc.totalGst + row.totalGst,
    }),
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalGst: 0 }
  );

  const SectionHeader = ({ title, count, icon: Icon, sectionKey }: {
    title: string;
    count: number;
    icon: React.ElementType;
    sectionKey: string;
  }) => (
    <button
      onClick={() => setActiveSection(activeSection === sectionKey ? '' : sectionKey)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-slate-600" />
        <span className="font-semibold text-slate-800">{title}</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
          {count} entries
        </span>
      </div>
      {activeSection === sectionKey ? (
        <ChevronUp className="w-5 h-5 text-slate-400" />
      ) : (
        <ChevronDown className="w-5 h-5 text-slate-400" />
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Information Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">GSTR-1 Report</p>
          <p className="text-xs text-blue-600 mt-1">
            This report shows data ready for GSTR-1 filing. Data is grouped by B2B (registered customers) and B2C (unregistered customers).
            Does NOT connect to GST Portal.
          </p>
        </div>
      </div>

      {/* B2B Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <SectionHeader
          title="B2B - Registered Customers"
          count={data.b2b.length}
          icon={Building}
          sectionKey="b2b"
        />
        {activeSection === 'b2b' && (
          <>
            {data.b2b.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No B2B invoices found for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Invoice No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Customer GSTIN</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Customer Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Taxable Value</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">IGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">CGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">SGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.b2b.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-sm">
                            {row.invoiceNo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.invoiceDate)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.customerGstin}</td>
                        <td className="px-4 py-3 text-slate-800 font-medium">{row.customerName}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(row.taxableValue)}</td>
                        <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(row.igst)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(row.cgst)}</td>
                        <td className="px-4 py-3 text-right text-teal-600">{formatCurrency(row.sgst)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(row.totalGst)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-4 py-3 text-slate-800" colSpan={4}>Total</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(b2bTotals.taxableValue)}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-bold">{formatCurrency(b2bTotals.igst)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">{formatCurrency(b2bTotals.cgst)}</td>
                      <td className="px-4 py-3 text-right text-teal-600 font-bold">{formatCurrency(b2bTotals.sgst)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(b2bTotals.totalGst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* B2C Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <SectionHeader
          title="B2C - Unregistered Customers"
          count={data.b2c.length}
          icon={ShoppingCart}
          sectionKey="b2c"
        />
        {activeSection === 'b2c' && (
          <>
            {data.b2c.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No B2C invoices found for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Invoice No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Customer Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Taxable Value</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">IGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">CGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">SGST</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Total GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.b2c.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium text-sm">
                            {row.invoiceNo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(row.invoiceDate)}</td>
                        <td className="px-4 py-3 text-slate-800 font-medium">{row.customerName}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(row.taxableValue)}</td>
                        <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(row.igst)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(row.cgst)}</td>
                        <td className="px-4 py-3 text-right text-teal-600">{formatCurrency(row.sgst)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(row.totalGst)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-4 py-3 text-slate-800" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(b2cTotals.taxableValue)}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-bold">{formatCurrency(b2cTotals.igst)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">{formatCurrency(b2cTotals.cgst)}</td>
                      <td className="px-4 py-3 text-right text-teal-600 font-bold">{formatCurrency(b2cTotals.sgst)}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(b2cTotals.totalGst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Credit Notes Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <SectionHeader
          title="Credit Notes"
          count={data.creditNotes.length}
          icon={FileText}
          sectionKey="credit"
        />
        {activeSection === 'credit' && (
          <>
            {data.creditNotes.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No credit notes found for the selected period.
              </div>
            ) : (
              <div className="p-4">
                <p className="text-sm text-slate-600">Credit notes data will be displayed here.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Debit Notes Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <SectionHeader
          title="Debit Notes"
          count={data.debitNotes.length}
          icon={FileText}
          sectionKey="debit"
        />
        {activeSection === 'debit' && (
          <>
            {data.debitNotes.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No debit notes found for the selected period.
              </div>
            ) : (
              <div className="p-4">
                <p className="text-sm text-slate-600">Debit notes data will be displayed here.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">GSTR-1 Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-slate-400 text-sm">B2B Invoices</p>
            <p className="text-2xl font-bold">{data.b2b.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">B2C Invoices</p>
            <p className="text-2xl font-bold">{data.b2c.length}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Taxable Value</p>
            <p className="text-2xl font-bold">{formatCurrency(b2bTotals.taxableValue + b2cTotals.taxableValue)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total GST Liability</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(b2bTotals.totalGst + b2cTotals.totalGst)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
