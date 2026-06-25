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
}

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
  products: Product[];
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  grandTotal: number;
  createdAt: string;
  selectedTemplateId?: string; // Link to template
}

export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Partial Payment' | 'Paid';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customer: Customer;
  products: Product[];
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  grandTotal: number;
  status: InvoiceStatus;
  notes?: string;
  sourceQuotationId?: string;
  sourceQuotationNumber?: string;
  selectedTemplateId?: string;
  createdAt: string;
  updatedAt: string;
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
  | 'quotation_number'
  | 'quotation_date'
  | 'product_table'
  | 'gst_summary'
  | 'bank_details'
  | 'signature_box'
  | 'footer_notes'
  | 'terms_conditions'
  | 'text_block'
  | 'totals';

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
}

export interface TableColumn {
  id: string;
  key: string;
  label: string;
  width: number; // percentage
  visible: boolean;
  order: number;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  blocks: TemplateBlock[];
  productColumns: TableColumn[];
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
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
  '{{grand_total}}': 'Rs. 0.00',
  '{{customer_address}}': 'Customer Address',
  '{{customer_mobile}}': 'Mobile',
  '{{customer_district}}': 'District',
  '{{customer_village}}': 'Village',
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDERS;

// A4 dimensions in mm
export const A4_WIDTH = 210;
export const A4_HEIGHT = 297;
export const A4_MARGIN = 10;
