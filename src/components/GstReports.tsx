import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  FileText,
  FileSpreadsheet,
  List,
  ShoppingBag,
  FileBox,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  Lightbulb,
  FileCheck,
  BookOpen,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { Invoice, CompanyProfile, PurchaseHistoryEntry } from '../types';
import {
  DateFilterType,
  DateRange,
  getDateRange,
  filterInvoicesByDateRange,
  calculateGstDashboard,
  calculateGstRateSummary,
  calculateHsnSacSummary,
  generateSalesRegister,
  generatePurchaseRegister,
  generateGstr1Report,
  validateInvoices,
  ValidationIssue,
} from '../utils/gstReports';
import { GstDashboard } from './gst/GstDashboard';
import { GstSummary } from './gst/GstSummary';
import { HsnSacSummary } from './gst/HsnSacSummary';
import { SalesRegister } from './gst/SalesRegister';
import { PurchaseRegister } from './gst/PurchaseRegister';
import { Gstr1Report } from './gst/Gstr1Report';
import { DateFilter } from './gst/DateFilter';
import { ExportButtons } from './gst/ExportButtons';
import { GstHealthCheck } from './gst/GstHealthCheck';
import { InvoiceIssueModal } from './gst/InvoiceIssueModal';
import { storage } from '../utils/storage';

// Local storage key for hiding educational guide
const GST_GUIDE_HIDDEN_KEY = 'laxmeejee_gst_guide_hidden';

type GstReportView =
  | 'dashboard'
  | 'gst_summary'
  | 'hsn_sac_summary'
  | 'sales_register'
  | 'purchase_register'
  | 'gstr1';

interface GstReportsProps {
  invoices: Invoice[];
  companyProfile: CompanyProfile;
  purchaseHistory?: PurchaseHistoryEntry[];
}

export const GstReports: React.FC<GstReportsProps> = ({
  invoices,
  companyProfile,
  purchaseHistory = [],
}) => {
  const [activeView, setActiveView] = useState<GstReportView>('dashboard');
  const [filterType, setFilterType] = useState<DateFilterType>('this_month');
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Calculate date range
  const dateRange = useMemo(() => {
    return getDateRange(filterType, customRange);
  }, [filterType, customRange]);

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    return filterInvoicesByDateRange(invoices, dateRange);
  }, [invoices, dateRange]);

  // Calculate all report data
  const reportData = useMemo(() => {
    const companyGstin = companyProfile.gstNumber || '';

    return {
      dashboard: calculateGstDashboard(filteredInvoices, companyGstin),
      gstSummary: calculateGstRateSummary(filteredInvoices, companyGstin),
      hsnSacSummary: calculateHsnSacSummary(filteredInvoices, companyGstin),
      salesRegister: generateSalesRegister(filteredInvoices, companyGstin),
      purchaseRegister: generatePurchaseRegister(purchaseHistory),
      gstr1: generateGstr1Report(filteredInvoices, companyGstin),
      validation: validateInvoices(filteredInvoices, companyGstin),
    };
  }, [filteredInvoices, companyProfile, purchaseHistory]);

  // Modal state for viewing affected invoices
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null);

  // Educational card state - default to collapsed, check if user hid it
  const [isEduCardExpanded, setIsEduCardExpanded] = useState(false);
  const [isGuideHidden, setIsGuideHidden] = useState(() => {
    const saved = localStorage.getItem(GST_GUIDE_HIDDEN_KEY);
    return saved === 'true';
  });

  // Handle "Don't show again" checkbox
  const handleDontShowAgain = (checked: boolean) => {
    setIsGuideHidden(checked);
    setIsEduCardExpanded(!checked);
    localStorage.setItem(GST_GUIDE_HIDDEN_KEY, String(checked));
  };

  // Handle restore guide
  const handleRestoreGuide = () => {
    setIsGuideHidden(false);
    setIsEduCardExpanded(true);
    localStorage.setItem(GST_GUIDE_HIDDEN_KEY, 'false');
  };

  const navItems: { view: GstReportView; label: string; icon: React.ElementType }[] = [
    { view: 'dashboard', label: 'GST Dashboard', icon: BarChart3 },
    { view: 'gst_summary', label: 'GST Summary', icon: FileText },
    { view: 'hsn_sac_summary', label: 'HSN/SAC Summary', icon: FileBox },
    { view: 'sales_register', label: 'Sales Register', icon: List },
    { view: 'purchase_register', label: 'Purchase Register', icon: ShoppingBag },
    { view: 'gstr1', label: 'GSTR-1 Ready', icon: FileSpreadsheet },
  ];

  const getExportColumns = () => {
    switch (activeView) {
      case 'gst_summary':
        return [
          { header: 'GST Rate (%)', key: 'gstRate' },
          { header: 'Taxable Value', key: 'taxableValue' },
          { header: 'CGST', key: 'cgst' },
          { header: 'SGST', key: 'sgst' },
          { header: 'IGST', key: 'igst' },
          { header: 'Total GST', key: 'totalGst' },
          { header: 'Invoice Count', key: 'invoiceCount' },
        ];
      case 'hsn_sac_summary':
        return [
          { header: 'HSN/SAC Code', key: 'hsnSacCode' },
          { header: 'Description', key: 'description' },
          { header: 'Taxable Value', key: 'taxableValue' },
          { header: 'GST Amount', key: 'gstAmount' },
          { header: 'Invoice Count', key: 'invoiceCount' },
        ];
      case 'sales_register':
        return [
          { header: 'Date', key: 'date' },
          { header: 'Invoice No', key: 'invoiceNo' },
          { header: 'Customer', key: 'customerName' },
          { header: 'GSTIN', key: 'customerGstin' },
          { header: 'Taxable Amount', key: 'taxableAmount' },
          { header: 'CGST', key: 'cgst' },
          { header: 'SGST', key: 'sgst' },
          { header: 'IGST', key: 'igst' },
          { header: 'GST', key: 'gst' },
          { header: 'Grand Total', key: 'grandTotal' },
        ];
      case 'purchase_register':
        return [
          { header: 'Vendor', key: 'vendorName' },
          { header: 'Purchase No', key: 'purchaseNo' },
          { header: 'Tax', key: 'tax' },
          { header: 'GST', key: 'gst' },
          { header: 'Total', key: 'total' },
        ];
      default:
        return [];
    }
  };

  const getExportData = () => {
    switch (activeView) {
      case 'gst_summary':
        return reportData.gstSummary;
      case 'hsn_sac_summary':
        return reportData.hsnSacSummary;
      case 'sales_register':
        return reportData.salesRegister;
      case 'purchase_register':
        return reportData.purchaseRegister;
      default:
        return [];
    }
  };

  const getReportName = () => {
    const dateStr = `${dateRange.startDate} to ${dateRange.endDate}`;
    switch (activeView) {
      case 'gst_summary':
        return `GST Summary ${dateStr}`;
      case 'hsn_sac_summary':
        return `HSN SAC Summary ${dateStr}`;
      case 'sales_register':
        return `Sales Register ${dateStr}`;
      case 'purchase_register':
        return `Purchase Register ${dateStr}`;
      default:
        return 'GST Report';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">GST Reports</h2>
            <p className="text-sm text-slate-500 mt-1">
              Generate comprehensive GST reports from your invoice data
            </p>
          </div>
          {isGuideHidden && (
            <button
              onClick={handleRestoreGuide}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Show GST Guide"
              aria-label="Show GST educational guide"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">GST Guide</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeView !== 'dashboard' && activeView !== 'gstr1' && (
            <ExportButtons
              data={getExportData()}
              reportName={getReportName()}
              columns={getExportColumns()}
            />
          )}
        </div>
      </div>

      {/* Date Filter */}
      <DateFilter
        filterType={filterType}
        customRange={customRange}
        onFilterChange={setFilterType}
        onCustomRangeChange={setCustomRange}
      />

      {/* Educational GSTR-1 Card - Only show if not hidden */}
      {!isGuideHidden && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
          <button
            onClick={() => setIsEduCardExpanded(!isEduCardExpanded)}
            className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-colors"
            aria-expanded={isEduCardExpanded}
            aria-controls="gst-guide-content"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <div className="text-left">
                <span className="font-semibold text-slate-800">What is GSTR-1?</span>
                <p className="text-xs text-slate-500 mt-0.5">New to GST? Learn what GSTR-1 means in less than 30 seconds.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-medium hidden sm:block">
                {isEduCardExpanded ? 'Close' : 'Learn More'}
              </span>
              {isEduCardExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
              )}
            </div>
          </button>

          <div
            id="gst-guide-content"
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isEduCardExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="space-y-4">
                {/* Compact explanation */}
                <div>
                  <h4 className="text-base font-semibold text-slate-800">GSTR-1 is your monthly GST Sales Report</h4>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                    GSTR-1 ek monthly report hai jisme is month ke saare GST invoices ki details Government ko batayi jaati hain.
                    This report is automatically prepared from your invoices and helps you review your GST sales before filing.
                  </p>
                </div>

                {/* Compact horizontal infographic */}
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-600">Invoice</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-700">GST Report</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-teal-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg">
                    <FileCheck className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white">GSTR-1 Ready</span>
                  </div>
                </div>

                {/* Features list - compact */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-emerald-500">✅</span>
                    <span>B2B Sales</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-emerald-500">✅</span>
                    <span>B2C Sales</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-emerald-500">✅</span>
                    <span>GST Summary</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-emerald-500">✅</span>
                    <span>HSN/SAC Summary</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="text-emerald-500">✅</span>
                    <span>Sales Register</span>
                  </div>
                </div>

                {/* Tip and Don't show again */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Tip: Ye report aapke invoices se automatically prepare hoti hai.</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isGuideHidden}
                      onChange={(e) => handleDontShowAgain(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-500">Don't show this guide again</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Important Notice - Only show if guide is visible */}
      {!isGuideHidden && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-800">Important</p>
            <p className="text-xs text-blue-700 mt-0.5">
              This report is generated from your invoice data for review purposes only.
              It does <strong>NOT</strong> file your GST return automatically.
              Filing must be completed separately on the GST Portal.
            </p>
          </div>
        </div>
      )}

      {/* GST Health Check */}
      <GstHealthCheck
        validationResult={reportData.validation}
        onViewInvoices={(issue) => setSelectedIssue(issue)}
      />

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setActiveView(item.view)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeView === item.view
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active View Content */}
      <div>
        {activeView === 'dashboard' && <GstDashboard data={reportData.dashboard} />}
        {activeView === 'gst_summary' && <GstSummary data={reportData.gstSummary} />}
        {activeView === 'hsn_sac_summary' && <HsnSacSummary data={reportData.hsnSacSummary} />}
        {activeView === 'sales_register' && <SalesRegister data={reportData.salesRegister} />}
        {activeView === 'purchase_register' && <PurchaseRegister data={reportData.purchaseRegister} />}
        {activeView === 'gstr1' && <Gstr1Report data={reportData.gstr1} />}
      </div>

      {/* Date Range Info */}
      <div className="bg-slate-50 rounded-lg p-4 text-center">
        <p className="text-sm text-slate-600">
          Showing data for period: <span className="font-semibold text-slate-800">
            {new Date(dateRange.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span> to{' '}
          <span className="font-semibold text-slate-800">
            {new Date(dateRange.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {' '} ({filteredInvoices.length} invoices)
        </p>
      </div>

      {/* Invoice Issue Modal */}
      {selectedIssue && (
        <InvoiceIssueModal
          issue={selectedIssue}
          invoices={filteredInvoices}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </div>
  );
};
