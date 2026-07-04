import { Invoice, Product, GstMode } from '../types';
import { calculateProductAmount, calculateTaxableAmount, calculateGstAmount, roundTo2 } from './storage';

// ─── GST Validation Types ─────────────────────────────────────────────────────

export type ValidationSeverity = 'success' | 'warning' | 'error';

export interface ValidationIssue {
  id: string;
  name: string;
  description: string;
  severity: ValidationSeverity;
  affectedCount: number;
  affectedInvoiceIds: string[];
}

export interface ValidationResult {
  issues: ValidationIssue[];
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  overallStatus: 'healthy' | 'warnings' | 'needs_attention';
}

// ─── GST Report Types ─────────────────────────────────────────────────────────

export type DateFilterType = 'today' | 'this_month' | 'last_month' | 'financial_year' | 'custom';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface GstDashboardData {
  taxableSales: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxFreeSales: number;
  totalGstCollected: number;
  totalInvoices: number;
}

export interface GstRateSummary {
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  invoiceCount: number;
}

export interface HsnSacSummary {
  hsnSacCode: string;
  description: string;
  taxableValue: number;
  gstAmount: number;
  invoiceCount: number;
}

export interface SalesRegisterEntry {
  date: string;
  invoiceNo: string;
  customerName: string;
  customerGstin: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  grandTotal: number;
}

export interface PurchaseRegisterEntry {
  vendorName: string;
  purchaseNo: string;
  gst: number;
  tax: number;
  total: number;
}

export interface Gstr1B2BEntry {
  invoiceNo: string;
  invoiceDate: string;
  customerGstin: string;
  customerName: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  invoiceType: 'B2B' | 'B2C';
}

export interface Gstr1CreditNoteEntry {
  noteNo: string;
  noteDate: string;
  customerGstin: string;
  customerName: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  reason: string;
}

// ─── Date Filter Helpers ──────────────────────────────────────────────────────

export const getDateRange = (filterType: DateFilterType, customRange?: DateRange): DateRange => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (filterType) {
    case 'today':
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };

    case 'this_month':
      const firstDayThisMonth = new Date(year, month, 1);
      const lastDayThisMonth = new Date(year, month + 1, 0);
      return {
        startDate: firstDayThisMonth.toISOString().split('T')[0],
        endDate: lastDayThisMonth.toISOString().split('T')[0],
      };

    case 'last_month':
      const firstDayLastMonth = new Date(year, month - 1, 1);
      const lastDayLastMonth = new Date(year, month, 0);
      return {
        startDate: firstDayLastMonth.toISOString().split('T')[0],
        endDate: lastDayLastMonth.toISOString().split('T')[0],
      };

    case 'financial_year':
      // Indian Financial Year: April 1 to March 31
      const currentFYStart = month >= 3 ? year : year - 1; // April is month 3 (0-indexed)
      return {
        startDate: `${currentFYStart}-04-01`,
        endDate: `${currentFYStart + 1}-03-31`,
      };

    case 'custom':
      return customRange || { startDate: '', endDate: '' };

    default:
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
  }
};

export const filterInvoicesByDateRange = (invoices: Invoice[], dateRange: DateRange): Invoice[] => {
  return invoices.filter(invoice => {
    const invoiceDate = new Date(invoice.date);
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    end.setHours(23, 59, 59, 999);
    return invoiceDate >= start && invoiceDate <= end;
  });
};

// ─── GST Calculations ──────────────────────────────────────────────────────────

// Calculate if sale is inter-state (IGST) based on GSTIN comparison
export const isInterState = (companyGstin: string, customerGstin: string): boolean => {
  if (!companyGstin || !customerGstin) return false;
  if (customerGstin.length < 2) return false;

  const companyStateCode = companyGstin.substring(0, 2);
  const customerStateCode = customerGstin.substring(0, 2);

  return companyStateCode !== customerStateCode;
};

// Calculate GST breakdown for a single product
export const calculateProductGst = (
  product: Product,
  gstMode: GstMode,
  isInterStateSale: boolean
): {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
} => {
  const baseAmount = calculateProductAmount(product);
  const taxableAmount = calculateTaxableAmount(baseAmount, product.gstPercent, gstMode);
  const totalGst = calculateGstAmount(baseAmount, product.gstPercent, gstMode);

  if (isInterStateSale) {
    return {
      taxableAmount,
      cgst: 0,
      sgst: 0,
      igst: roundTo2(totalGst),
      totalGst: roundTo2(totalGst),
    };
  } else {
    return {
      taxableAmount,
      cgst: roundTo2(totalGst / 2),
      sgst: roundTo2(totalGst / 2),
      igst: 0,
      totalGst: roundTo2(totalGst),
    };
  }
};

// ─── GST Dashboard Calculations ────────────────────────────────────────────────

export const calculateGstDashboard = (
  invoices: Invoice[],
  companyGstin: string
): GstDashboardData => {
  let taxableSales = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let taxFreeSales = 0;
  let totalInvoices = invoices.length;

  invoices.forEach(invoice => {
    const gstMode = invoice.gstMode || 'inclusive';
    const isInter = isInterState(companyGstin, invoice.customer.gstNumber || '');

    invoice.products.forEach(product => {
      const gstData = calculateProductGst(product, gstMode, isInter);

      if (product.gstPercent === 0) {
        taxFreeSales += gstData.taxableAmount;
      } else {
        taxableSales += gstData.taxableAmount;
      }

      cgst += gstData.cgst;
      sgst += gstData.sgst;
      igst += gstData.igst;
    });
  });

  return {
    taxableSales: roundTo2(taxableSales),
    cgst: roundTo2(cgst),
    sgst: roundTo2(sgst),
    igst: roundTo2(igst),
    taxFreeSales: roundTo2(taxFreeSales),
    totalGstCollected: roundTo2(cgst + sgst + igst),
    totalInvoices,
  };
};

// ─── GST Rate Summary (Group by GST Rate) ──────────────────────────────────────

export const calculateGstRateSummary = (
  invoices: Invoice[],
  companyGstin: string
): GstRateSummary[] => {
  const rateMap = new Map<number, {
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    invoiceSet: Set<string>;
  }>();

  invoices.forEach(invoice => {
    const gstMode = invoice.gstMode || 'inclusive';
    const isInter = isInterState(companyGstin, invoice.customer.gstNumber || '');

    invoice.products.forEach(product => {
      const gstData = calculateProductGst(product, gstMode, isInter);
      const rate = product.gstPercent;

      if (rateMap.has(rate)) {
        const existing = rateMap.get(rate)!;
        existing.taxableValue += gstData.taxableAmount;
        existing.cgst += gstData.cgst;
        existing.sgst += gstData.sgst;
        existing.igst += gstData.igst;
        existing.invoiceSet.add(invoice.id);
      } else {
        rateMap.set(rate, {
          taxableValue: gstData.taxableAmount,
          cgst: gstData.cgst,
          sgst: gstData.sgst,
          igst: gstData.igst,
          invoiceSet: new Set([invoice.id]),
        });
      }
    });
  });

  const rates = [0, 5, 12, 18, 28];
  const result: GstRateSummary[] = [];

  rates.forEach(rate => {
    const data = rateMap.get(rate);
    if (data) {
      result.push({
        gstRate: rate,
        taxableValue: roundTo2(data.taxableValue),
        cgst: roundTo2(data.cgst),
        sgst: roundTo2(data.sgst),
        igst: roundTo2(data.igst),
        totalGst: roundTo2(data.cgst + data.sgst + data.igst),
        invoiceCount: data.invoiceSet.size,
      });
    } else {
      result.push({
        gstRate: rate,
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalGst: 0,
        invoiceCount: 0,
      });
    }
  });

  return result;
};

// ─── HSN/SAC Summary ───────────────────────────────────────────────────────────

export const calculateHsnSacSummary = (
  invoices: Invoice[],
  companyGstin: string
): HsnSacSummary[] => {
  const hsnMap = new Map<string, {
    description: string;
    taxableValue: number;
    gstAmount: number;
    invoiceSet: Set<string>;
  }>();

  invoices.forEach(invoice => {
    const gstMode = invoice.gstMode || 'inclusive';
    const isInter = isInterState(companyGstin, invoice.customer.gstNumber || '');

    invoice.products.forEach(product => {
      const hsnCode = product.hsnSacCode || 'N/A';
      const gstData = calculateProductGst(product, gstMode, isInter);

      if (hsnMap.has(hsnCode)) {
        const existing = hsnMap.get(hsnCode)!;
        existing.taxableValue += gstData.taxableAmount;
        existing.gstAmount += gstData.totalGst;
        existing.invoiceSet.add(invoice.id);
      } else {
        hsnMap.set(hsnCode, {
          description: product.name,
          taxableValue: gstData.taxableAmount,
          gstAmount: gstData.totalGst,
          invoiceSet: new Set([invoice.id]),
        });
      }
    });
  });

  return Array.from(hsnMap.entries())
    .map(([hsnSacCode, data]) => ({
      hsnSacCode,
      description: data.description,
      taxableValue: roundTo2(data.taxableValue),
      gstAmount: roundTo2(data.gstAmount),
      invoiceCount: data.invoiceSet.size,
    }))
    .sort((a, b) => b.taxableValue - a.taxableValue);
};

// ─── Sales Register ───────────────────────────────────────────────────────────

export const generateSalesRegister = (
  invoices: Invoice[],
  companyGstin: string
): SalesRegisterEntry[] => {
  return invoices.map(invoice => {
    const gstMode = invoice.gstMode || 'inclusive';
    const isInter = isInterState(companyGstin, invoice.customer.gstNumber || '');

    let taxableAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    invoice.products.forEach(product => {
      const gstData = calculateProductGst(product, gstMode, isInter);
      taxableAmount += gstData.taxableAmount;
      cgst += gstData.cgst;
      sgst += gstData.sgst;
      igst += gstData.igst;
    });

    return {
      date: invoice.date,
      invoiceNo: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      customerGstin: invoice.customer.gstNumber || '',
      taxableAmount: roundTo2(taxableAmount),
      cgst: roundTo2(cgst),
      sgst: roundTo2(sgst),
      igst: roundTo2(igst),
      gst: roundTo2(cgst + sgst + igst),
      grandTotal: invoice.grandTotal,
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// ─── GSTR-1 Report Generation ─────────────────────────────────────────────────

export const generateGstr1Report = (
  invoices: Invoice[],
  companyGstin: string
): {
  b2b: Gstr1B2BEntry[];
  b2c: Gstr1B2BEntry[];
  creditNotes: Gstr1CreditNoteEntry[];
  debitNotes: Gstr1CreditNoteEntry[];
} => {
  const b2b: Gstr1B2BEntry[] = [];
  const b2c: Gstr1B2BEntry[] = [];

  invoices.forEach(invoice => {
    const gstMode = invoice.gstMode || 'inclusive';
    const hasGstin = !!(invoice.customer.gstNumber && invoice.customer.gstNumber.length >= 15);
    const isInter = isInterState(companyGstin, invoice.customer.gstNumber || '');

    let taxableValue = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    invoice.products.forEach(product => {
      const gstData = calculateProductGst(product, gstMode, isInter);
      taxableValue += gstData.taxableAmount;
      cgst += gstData.cgst;
      sgst += gstData.sgst;
      igst += gstData.igst;
    });

    const entry: Gstr1B2BEntry = {
      invoiceNo: invoice.invoiceNumber,
      invoiceDate: invoice.date,
      customerGstin: invoice.customer.gstNumber || '',
      customerName: invoice.customer.name,
      taxableValue: roundTo2(taxableValue),
      igst: roundTo2(igst),
      cgst: roundTo2(cgst),
      sgst: roundTo2(sgst),
      totalGst: roundTo2(cgst + sgst + igst),
      invoiceType: hasGstin ? 'B2B' : 'B2C',
    };

    if (hasGstin) {
      b2b.push(entry);
    } else {
      b2c.push(entry);
    }
  });

  // Credit/Debit notes placeholder (future implementation)
  // These would be calculated from credit/debit note entries if they exist in invoices
  const creditNotes: Gstr1CreditNoteEntry[] = [];
  const debitNotes: Gstr1CreditNoteEntry[] = [];

  return {
    b2b: b2b.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()),
    b2c: b2c.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()),
    creditNotes,
    debitNotes,
  };
};

// ─── Purchase Register (Placeholder - uses imports data) ───────────────────────

export const generatePurchaseRegister = (
  purchaseHistory: Array<{
    supplierName?: string;
    invoiceNumber?: string;
    purchasePrice: number;
    quantityPurchased: number;
    gstPercent: number;
  }>
): PurchaseRegisterEntry[] => {
  const purchaseMap = new Map<string, {
    vendorName: string;
    totalGst: number;
    totalTax: number;
    totalAmount: number;
  }>();

  purchaseHistory.forEach(purchase => {
    const key = `${purchase.supplierName || 'Unknown'}_${purchase.invoiceNumber || 'N/A'}`;
    const baseAmount = purchase.purchasePrice * purchase.quantityPurchased;
    const taxAmount = baseAmount * (purchase.gstPercent / 100);

    if (purchaseMap.has(key)) {
      const existing = purchaseMap.get(key)!;
      existing.totalGst += taxAmount;
      existing.totalTax += baseAmount;
      existing.totalAmount += baseAmount + taxAmount;
    } else {
      purchaseMap.set(key, {
        vendorName: purchase.supplierName || 'Unknown',
        totalGst: roundTo2(taxAmount),
        totalTax: roundTo2(baseAmount),
        totalAmount: roundTo2(baseAmount + taxAmount),
      });
    }
  });

  return Array.from(purchaseMap.values()).map(entry => ({
    vendorName: entry.vendorName,
    purchaseNo: purchaseHistory.find(p => p.supplierName === entry.vendorName)?.invoiceNumber || 'N/A',
    gst: entry.totalGst,
    tax: entry.totalTax,
    total: entry.totalAmount,
  }));
};

// ─── Export Helpers ───────────────────────────────────────────────────────────

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ─── GST Health Check Validation ─────────────────────────────────────────────

export const validateInvoices = (
  invoices: Invoice[],
  companyGstin: string
): ValidationResult => {
  const issues: ValidationIssue[] = [];

  // 1. Check for Duplicate Invoice Numbers
  const invoiceNumbers = new Map<string, string[]>();
  invoices.forEach(invoice => {
    const num = invoice.invoiceNumber;
    if (!invoiceNumbers.has(num)) {
      invoiceNumbers.set(num, []);
    }
    invoiceNumbers.get(num)!.push(invoice.id);
  });

  const duplicates: string[] = [];
  invoiceNumbers.forEach((ids, num) => {
    if (ids.length > 1) {
      duplicates.push(...ids);
    }
  });

  issues.push({
    id: 'duplicate_invoice_numbers',
    name: 'Duplicate Invoice Numbers',
    description: 'Invoices with the same invoice number',
    severity: duplicates.length > 0 ? 'error' : 'success',
    affectedCount: duplicates.length,
    affectedInvoiceIds: duplicates,
  });

  // 2. Check for Missing GSTIN (for B2B customers)
  const missingGstin: string[] = [];
  invoices.forEach(invoice => {
    // If customer has a business-like name pattern or high value, they should have GSTIN
    // For now, check if invoice is B2B (high value) but missing GSTIN
    const hasGstInProducts = invoice.products.some(p => p.gstPercent > 0);
    const isHighValue = invoice.grandTotal >= 50000;
    const missingCustomerGstin = !invoice.customer.gstNumber || invoice.customer.gstNumber.length < 15;

    if (hasGstInProducts && isHighValue && missingCustomerGstin) {
      missingGstin.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_gstin',
    name: 'Missing GSTIN',
    description: 'High-value B2B invoices missing customer GSTIN',
    severity: missingGstin.length > 0 ? 'warning' : 'success',
    affectedCount: missingGstin.length,
    affectedInvoiceIds: missingGstin,
  });

  // 3. Check for Missing Customer Name
  const missingCustomerName: string[] = [];
  invoices.forEach(invoice => {
    if (!invoice.customer.name || invoice.customer.name.trim() === '') {
      missingCustomerName.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_customer_name',
    name: 'Missing Customer Name',
    description: 'Invoices without customer name',
    severity: missingCustomerName.length > 0 ? 'error' : 'success',
    affectedCount: missingCustomerName.length,
    affectedInvoiceIds: missingCustomerName,
  });

  // 4. Check for Missing HSN/SAC
  const missingHsn: string[] = [];
  invoices.forEach(invoice => {
    const hasProductsMissingHsn = invoice.products.some(
      p => !p.hsnSacCode || p.hsnSacCode.trim() === ''
    );
    if (hasProductsMissingHsn) {
      missingHsn.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_hsn_sac',
    name: 'Missing HSN/SAC',
    description: 'Products without HSN/SAC code',
    severity: missingHsn.length > 0 ? 'warning' : 'success',
    affectedCount: missingHsn.length,
    affectedInvoiceIds: missingHsn,
  });

  // 5. Check for Missing GST Rate
  const missingGstRate: string[] = [];
  invoices.forEach(invoice => {
    const hasMissingGst = invoice.products.some(
      p => p.gstPercent === undefined || p.gstPercent === null
    );
    if (hasMissingGst) {
      missingGstRate.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_gst_rate',
    name: 'Missing GST Rate',
    description: 'Products without GST rate',
    severity: missingGstRate.length > 0 ? 'error' : 'success',
    affectedCount: missingGstRate.length,
    affectedInvoiceIds: missingGstRate,
  });

  // 6. Check for Invalid GST Calculation
  const invalidGstCalc: string[] = [];
  invoices.forEach(invoice => {
    const gstMode = invoice.gstMode || 'inclusive';
    const isInter = isInterState(companyGstin, invoice.customer.gstNumber || '');

    const calculatedTotalCGST = invoice.products.reduce((sum, p) => {
      const baseAmount = calculateProductAmount(p);
      const gstAmount = calculateGstAmount(baseAmount, p.gstPercent, gstMode);
      return sum + (isInter ? 0 : gstAmount / 2);
    }, 0);

    const calculatedTotalSGST = invoice.products.reduce((sum, p) => {
      const baseAmount = calculateProductAmount(p);
      const gstAmount = calculateGstAmount(baseAmount, p.gstPercent, gstMode);
      return sum + (isInter ? 0 : gstAmount / 2);
    }, 0);

    // Allow small rounding differences (within 1 rupee)
    const cgstDiff = Math.abs(invoice.totalCgst - roundTo2(calculatedTotalCGST));
    const sgstDiff = Math.abs(invoice.totalSgst - roundTo2(calculatedTotalSGST));

    if (cgstDiff > 1 || sgstDiff > 1) {
      invalidGstCalc.push(invoice.id);
    }
  });

  issues.push({
    id: 'invalid_gst_calculation',
    name: 'Invalid GST Calculation',
    description: 'GST amounts do not match calculated values',
    severity: invalidGstCalc.length > 0 ? 'error' : 'success',
    affectedCount: invalidGstCalc.length,
    affectedInvoiceIds: invalidGstCalc,
  });

  // 7. Check for Missing Invoice Date
  const missingInvoiceDate: string[] = [];
  invoices.forEach(invoice => {
    if (!invoice.date || invoice.date.trim() === '') {
      missingInvoiceDate.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_invoice_date',
    name: 'Missing Invoice Date',
    description: 'Invoices without date',
    severity: missingInvoiceDate.length > 0 ? 'error' : 'success',
    affectedCount: missingInvoiceDate.length,
    affectedInvoiceIds: missingInvoiceDate,
  });

  // 8. Check for Missing Invoice Number
  const missingInvoiceNumber: string[] = [];
  invoices.forEach(invoice => {
    if (!invoice.invoiceNumber || invoice.invoiceNumber.trim() === '') {
      missingInvoiceNumber.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_invoice_number',
    name: 'Missing Invoice Number',
    description: 'Invoices without invoice number',
    severity: missingInvoiceNumber.length > 0 ? 'error' : 'success',
    affectedCount: missingInvoiceNumber.length,
    affectedInvoiceIds: missingInvoiceNumber,
  });

  // 9. Check for Zero Tax Invoice
  const zeroTaxInvoices: string[] = [];
  invoices.forEach(invoice => {
    const hasTaxableProducts = invoice.products.some(p => p.gstPercent > 0);
    const totalGst = invoice.totalCgst + invoice.totalSgst;
    if (hasTaxableProducts && totalGst === 0) {
      zeroTaxInvoices.push(invoice.id);
    }
  });

  issues.push({
    id: 'zero_tax_invoice',
    name: 'Zero Tax Invoice',
    description: 'Invoices with taxable products but zero GST',
    severity: zeroTaxInvoices.length > 0 ? 'warning' : 'success',
    affectedCount: zeroTaxInvoices.length,
    affectedInvoiceIds: zeroTaxInvoices,
  });

  // 10. Check for Missing Customer State
  const missingCustomerState: string[] = [];
  invoices.forEach(invoice => {
    // Check if district is present (used as state indicator in this system)
    if (!invoice.customer.district || invoice.customer.district.trim() === '') {
      missingCustomerState.push(invoice.id);
    }
  });

  issues.push({
    id: 'missing_customer_state',
    name: 'Missing Customer State',
    description: 'Invoices without customer state/district',
    severity: missingCustomerState.length > 0 ? 'warning' : 'success',
    affectedCount: missingCustomerState.length,
    affectedInvoiceIds: missingCustomerState,
  });

  // Calculate summary
  const healthyCount = issues.filter(i => i.severity === 'success').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const errorCount = issues.filter(i => i.severity === 'error').length;

  let overallStatus: 'healthy' | 'warnings' | 'needs_attention' = 'healthy';
  if (errorCount > 0) {
    overallStatus = 'needs_attention';
  } else if (warningCount > 0) {
    overallStatus = 'warnings';
  }

  return {
    issues,
    healthyCount,
    warningCount,
    errorCount,
    overallStatus,
  };
};
