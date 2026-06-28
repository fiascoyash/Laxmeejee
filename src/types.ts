export interface CompanyProfile {
  companyName: string;
  logo: string;
  gstNumber: string;
  address: string;
  email: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  signature: string;
}

export interface Customer {
  name: string;
  billingAddress: string;
  mobile: string;
  district: string;
  village: string;
  gstNumber?: string;
}

export interface ShipTo {
  name: string;
  address: string;
  mobile: string;
  gstNumber?: string;
}

export type GstMode = 'inclusive' | 'exclusive';

export interface Product {
  id: string;
  name: string;
  hsnCode: string;
  gstPercent: number;
  quantity: number;
  unitPrice: number;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  hsnCode: string;
  gstPercent: number;
  defaultPrice: number;
  createdAt: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  date: string;
  customer: Customer;
  shipTo?: ShipTo;
  products: Product[];
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  roundOff: number;
  grandTotal: number;
  createdAt: string;
  selectedTemplateId?: string; // Link to template
  productColumns?: TableColumn[]; // Per-quotation column visibility
  gstMode?: GstMode; // GST calculation mode
}

export interface NumberingSettings {
  quotationPrefix: string;
  quotationIncludeYear: boolean;
  quotationStartNumber: number;
  quotationAutoIncrement: boolean;
  quotationNextNumber: number;
  invoicePrefix: string;
  invoiceIncludeYear: boolean;
  invoiceStartNumber: number;
  invoiceAutoIncrement: boolean;
  invoiceNextNumber: number;
}

export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Partial Payment' | 'Paid';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customer: Customer;
  shipTo?: ShipTo;
  products: Product[];
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  roundOff: number;
  grandTotal: number;
  status: InvoiceStatus;
  notes?: string;
  sourceQuotationId?: string;
  sourceQuotationNumber?: string;
  selectedTemplateId?: string;
  createdAt: string;
  updatedAt: string;
  productColumns?: TableColumn[]; // Per-invoice column visibility
  gstMode?: GstMode; // GST calculation mode
}

export interface TaxSummary {
  hsnCode: string;
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
}

// Template Builder Types
export type BlockType =
  | 'company_logo'
  | 'company_details'
  | 'customer_details'
  | 'ship_to_details'
  | 'quotation_number'
  | 'quotation_date'
  | 'product_table'
  | 'gst_summary'
  | 'bank_details'
  | 'signature_box'
  | 'footer_notes'
  | 'terms_conditions'
  | 'text_block'
  | 'totals'
  | 'rectangle'
  | 'horizontal_line'
  | 'vertical_line'
  | 'divider';

export interface TemplateBlock {
  id: string;
  type: BlockType;
  x: number; // mm from left
  y: number; // mm from top
  width: number; // mm
  height: number; // mm
  content?: string; // for text blocks
  style?: BlockStyle;
  visible: boolean;
  locked?: boolean; // locked blocks cannot be dragged accidentally
  zIndex?: number; // layer order
  columns?: TableColumn[]; // for product table
}

export interface BlockStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  filled?: boolean; // rectangle: filled background vs border-only
  thickness?: number; // line blocks: line thickness in mm
}

export interface TableColumn {
  id: string;
  key: string;
  label: string;
  width: number; // percentage
  visible: boolean;
  order: number;
}

// Template Category for organization
export type TemplateCategory = 'professional' | 'gst' | 'retail' | 'modern' | 'luxury' | 'specialty';

// Template Settings - Dynamic toggles like myBillBook
export interface TemplateSettings {
  // Invoice Details
  showPoNumber: boolean;
  showVehicleNumber: boolean;
  showEwayBill: boolean;
  showDueDate: boolean;
  // Party Details
  showPhone: boolean;
  showGstin: boolean;
  showBillingAddress: boolean;
  showShippingAddress: boolean;
  // Item Table Columns
  showDescription: boolean;
  showQuantity: boolean;
  showUnit: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showBatchNumber: boolean;
  showExpiryDate: boolean;
  // Miscellaneous
  showBankDetails: boolean;
  showPaymentQr: boolean;
  showSignature: boolean;
  showNotes: boolean;
  showTermsConditions: boolean;
  showWatermark: boolean;
}

export const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  showPoNumber: false,
  showVehicleNumber: false,
  showEwayBill: false,
  showDueDate: true,
  showPhone: true,
  showGstin: true,
  showBillingAddress: true,
  showShippingAddress: false,
  showDescription: true,
  showQuantity: true,
  showUnit: true,
  showDiscount: false,
  showTax: true,
  showBatchNumber: false,
  showExpiryDate: false,
  showBankDetails: true,
  showPaymentQr: false,
  showSignature: true,
  showNotes: true,
  showTermsConditions: true,
  showWatermark: false,
};

// ─── Invoice Theme System ────────────────────────────────────────────────────
export type ThemeId = 'luxury' | 'stylish' | 'tally' | 'billbook' | 'modern' | 'simple';

export interface InvoiceTheme {
  id: ThemeId;
  name: string;
  // Header
  headerBg: string;
  headerTextColor: string;
  headerBorderColor: string;
  // Table
  tableHeaderBg: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
  tableRowAltBg: string;
  // Accent / primary color
  primaryColor: string;
  accentColor: string;
  // Section separators
  sectionBorderColor: string;
  // Page
  outerBorder: boolean;
  outerBorderWidth: number;
  cornerDecorations: boolean;
  accentBar: boolean;        // colored bar under header
  // Typography
  companyNameSize: number;
  companyNameColor: string;
  docTypeFontSize: number;
}

export const INVOICE_THEMES: Record<ThemeId, InvoiceTheme> = {
  luxury: {
    id: 'luxury',
    name: 'Luxury',
    headerBg: '#FFFFFF',
    headerTextColor: '#1A1A2E',
    headerBorderColor: '#C9A84C',
    tableHeaderBg: '#FDF8EC',
    tableHeaderTextColor: '#333333',
    tableBorderColor: '#E8D5A0',
    tableRowAltBg: '#FFFDF5',
    primaryColor: '#C9A84C',
    accentColor: '#9E7B2D',
    sectionBorderColor: '#C9A84C',
    outerBorder: true,
    outerBorderWidth: 2,
    cornerDecorations: true,
    accentBar: false,
    companyNameSize: 22,
    companyNameColor: '#1A1A2E',
    docTypeFontSize: 15,
  },
  stylish: {
    id: 'stylish',
    name: 'Stylish',
    headerBg: '#1E3A5F',
    headerTextColor: '#FFFFFF',
    headerBorderColor: '#1E3A5F',
    tableHeaderBg: '#EFF6FF',
    tableHeaderTextColor: '#1E3A5F',
    tableBorderColor: '#BFDBFE',
    tableRowAltBg: '#F8FBFF',
    primaryColor: '#2563EB',
    accentColor: '#1D4ED8',
    sectionBorderColor: '#DBEAFE',
    outerBorder: true,
    outerBorderWidth: 1,
    cornerDecorations: false,
    accentBar: false,
    companyNameSize: 20,
    companyNameColor: '#FFFFFF',
    docTypeFontSize: 14,
  },
  tally: {
    id: 'tally',
    name: 'Advanced GST (Tally)',
    headerBg: '#FFFFFF',
    headerTextColor: '#000000',
    headerBorderColor: '#000000',
    tableHeaderBg: '#F3F4F6',
    tableHeaderTextColor: '#000000',
    tableBorderColor: '#000000',
    tableRowAltBg: '#FAFAFA',
    primaryColor: '#000000',
    accentColor: '#374151',
    sectionBorderColor: '#000000',
    outerBorder: true,
    outerBorderWidth: 2,
    cornerDecorations: false,
    accentBar: false,
    companyNameSize: 17,
    companyNameColor: '#000000',
    docTypeFontSize: 13,
  },
  billbook: {
    id: 'billbook',
    name: 'Billbook',
    headerBg: '#FFFFFF',
    headerTextColor: '#111827',
    headerBorderColor: '#F97316',
    tableHeaderBg: '#FFF7ED',
    tableHeaderTextColor: '#111827',
    tableBorderColor: '#FED7AA',
    tableRowAltBg: '#FFFAF5',
    primaryColor: '#F97316',
    accentColor: '#EA6B0A',
    sectionBorderColor: '#FED7AA',
    outerBorder: false,
    outerBorderWidth: 0,
    cornerDecorations: false,
    accentBar: true,
    companyNameSize: 20,
    companyNameColor: '#111827',
    docTypeFontSize: 14,
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    headerBg: '#F8FAFC',
    headerTextColor: '#0F172A',
    headerBorderColor: '#E2E8F0',
    tableHeaderBg: '#F1F5F9',
    tableHeaderTextColor: '#0F172A',
    tableBorderColor: '#E2E8F0',
    tableRowAltBg: '#F8FAFC',
    primaryColor: '#6366F1',
    accentColor: '#4F46E5',
    sectionBorderColor: '#E2E8F0',
    outerBorder: false,
    outerBorderWidth: 0,
    cornerDecorations: false,
    accentBar: false,
    companyNameSize: 20,
    companyNameColor: '#0F172A',
    docTypeFontSize: 14,
  },
  simple: {
    id: 'simple',
    name: 'Simple',
    headerBg: '#FFFFFF',
    headerTextColor: '#111827',
    headerBorderColor: '#D1D5DB',
    tableHeaderBg: '#F9FAFB',
    tableHeaderTextColor: '#374151',
    tableBorderColor: '#D1D5DB',
    tableRowAltBg: '#FFFFFF',
    primaryColor: '#374151',
    accentColor: '#1F2937',
    sectionBorderColor: '#E5E7EB',
    outerBorder: false,
    outerBorderWidth: 0,
    cornerDecorations: false,
    accentBar: false,
    companyNameSize: 18,
    companyNameColor: '#111827',
    docTypeFontSize: 13,
  },
};

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  category?: TemplateCategory;
  themeId?: ThemeId;          // controls visual appearance (optional for legacy templates)
  blocks?: TemplateBlock[];  // optional: for advanced canvas editor
  productColumns?: TableColumn[];
  settings?: TemplateSettings;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  isPremium?: boolean;
}

export interface TemplateData {
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
}

export const PLACEHOLDERS = {
  '{{customer_name}}': 'Customer Name',
  '{{quotation_no}}': 'QT-2024-0001',
  '{{date}}': new Date().toISOString().split('T')[0],
  '{{total_amount}}': 'Rs. 0.00',
  '{{company_name}}': 'Company Name',
  '{{gst_number}}': 'GSTIN',
  '{{company_address}}': 'Company Address',
  '{{company_phone}}': 'Phone',
  '{{company_email}}': 'Email',
  '{{bank_name}}': 'Bank Name',
  '{{bank_account}}': 'Account Number',
  '{{bank_ifsc}}': 'IFSC Code',
  '{{taxable_amount}}': 'Rs. 0.00',
  '{{cgst_amount}}': 'Rs. 0.00',
  '{{sgst_amount}}': 'Rs. 0.00',
  '{{round_off}}': 'Rs. 0.00',
  '{{grand_total}}': 'Rs. 0.00',
  '{{amount_in_words}}': 'Zero Rupees Only',
  '{{customer_address}}': 'Customer Address',
  '{{customer_mobile}}': 'Mobile',
  '{{customer_district}}': 'District',
  '{{customer_village}}': 'Village',
  '{{ship_name}}': 'Ship To Name',
  '{{ship_address}}': 'Ship To Address',
  '{{ship_phone}}': 'Ship To Phone',
  '{{ship_gst}}': 'Ship To GST',
  '{{po_number}}': 'PO Number',
  '{{vehicle_number}}': 'Vehicle Number',
  '{{eway_bill}}': 'E-Way Bill Number',
  '{{due_date}}': 'Due Date',
  '{{invoice_number}}': 'Invoice Number',
  '{{invoice_date}}': 'Invoice Date',
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDERS;

// A4 dimensions in mm
export const A4_WIDTH = 210;
export const A4_HEIGHT = 297;
export const A4_MARGIN = 10;
