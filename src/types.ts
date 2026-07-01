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
  // Business Type
  businessType?: BusinessType;
}

// Business Types for Company Profile
export type BusinessType =
  | 'general'
  | 'retail_garments'
  | 'pharmacy_medical'
  | 'jewellery'
  | 'education'
  | 'restaurant_hotel'
  | 'electronics_mobile'
  | 'automobile'
  | 'service'
  | 'hardware_cement'
  | 'custom';

// Business Type Options for Dropdown
export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: 'general', label: 'General Business' },
  { value: 'retail_garments', label: 'Retail / Garments' },
  { value: 'pharmacy_medical', label: 'Pharmacy / Medical' },
  { value: 'jewellery', label: 'Jewellery Store' },
  { value: 'education', label: 'School / College / Education' },
  { value: 'restaurant_hotel', label: 'Restaurant / Hotel' },
  { value: 'electronics_mobile', label: 'Electronics / Mobile' },
  { value: 'automobile', label: 'Automobile / Spare Parts' },
  { value: 'service', label: 'Service Business' },
  { value: 'hardware_cement', label: 'Hardware / Cement' },
  { value: 'custom', label: 'Custom Business' },
];

// Business Type Dynamic Field Definitions
export interface BusinessTypeFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// Business Type Field Configurations - maps business types to their additional fields
export const BUSINESS_TYPE_FIELDS: Record<BusinessType, BusinessTypeFieldConfig[]> = {
  general: [],
  retail_garments: [
    { key: 'size', label: 'Size', type: 'text', placeholder: 'e.g., S, M, L, XL' },
    { key: 'color', label: 'Color', type: 'text', placeholder: 'e.g., Red, Blue' },
    { key: 'barcode', label: 'Barcode', type: 'text', placeholder: 'Product barcode' },
    { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
  ],
  pharmacy_medical: [
    { key: 'batchNumber', label: 'Batch Number', type: 'text', required: true, placeholder: 'Batch no.' },
    { key: 'expiryDate', label: 'Expiry Date', type: 'date', required: true },
    { key: 'manufacturingDate', label: 'Manufacturing Date', type: 'date' },
    { key: 'manufacturer', label: 'Manufacturer', type: 'text', placeholder: 'Manufacturer name' },
  ],
  jewellery: [
    { key: 'metalType', label: 'Metal Type', type: 'select', options: [
      { value: 'gold', label: 'Gold' },
      { value: 'silver', label: 'Silver' },
      { value: 'platinum', label: 'Platinum' },
      { value: 'diamond', label: 'Diamond' },
    ]},
    { key: 'purity', label: 'Purity', type: 'select', options: [
      { value: '24K', label: '24K (99.9%)' },
      { value: '22K', label: '22K (91.6%)' },
      { value: '18K', label: '18K (75%)' },
      { value: '14K', label: '14K (58.3%)' },
    ]},
    { key: 'weight', label: 'Weight (grams)', type: 'number', placeholder: 'Weight in grams' },
    { key: 'makingCharges', label: 'Making Charges', type: 'number', placeholder: 'Making charges' },
    { key: 'stoneCharges', label: 'Stone Charges', type: 'number', placeholder: 'Stone charges' },
  ],
  education: [
    { key: 'feesType', label: 'Fees Type', type: 'select', options: [
      { value: 'tuition', label: 'Tuition Fees' },
      { value: 'admission', label: 'Admission Fees' },
      { value: 'exam', label: 'Exam Fees' },
      { value: 'library', label: 'Library Fees' },
      { value: 'lab', label: 'Lab Fees' },
      { value: 'transport', label: 'Transport Fees' },
      { value: 'other', label: 'Other Fees' },
    ]},
    { key: 'studentRollNo', label: 'Student Roll Number', type: 'text', placeholder: 'Roll number' },
    { key: 'courseClass', label: 'Course/Class', type: 'text', placeholder: 'e.g., Class 10, BCA' },
    { key: 'sessionYear', label: 'Session Year', type: 'text', placeholder: 'e.g., 2024-25' },
  ],
  restaurant_hotel: [
    { key: 'tableNumber', label: 'Table Number', type: 'text', placeholder: 'Table no.' },
    { key: 'roomNumber', label: 'Room Number', type: 'text', placeholder: 'Room no.' },
    { key: 'foodCategory', label: 'Food Category', type: 'select', options: [
      { value: 'veg', label: 'Vegetarian' },
      { value: 'non-veg', label: 'Non-Vegetarian' },
      { value: 'egg', label: 'Egg' },
    ]},
    { key: 'kot', label: 'Kitchen Order Ticket (KOT)', type: 'text', placeholder: 'KOT number' },
  ],
  electronics_mobile: [
    { key: 'serialNumber', label: 'Serial Number', type: 'text', placeholder: 'Serial no.' },
    { key: 'imeiNumber', label: 'IMEI Number', type: 'text', placeholder: 'IMEI number' },
    { key: 'warrantyPeriod', label: 'Warranty Period', type: 'text', placeholder: 'e.g., 12 months' },
    { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
  ],
  automobile: [
    { key: 'vehicleModel', label: 'Vehicle Model', type: 'text', placeholder: 'e.g., Maruti Swift' },
    { key: 'partNumber', label: 'Part Number', type: 'text', placeholder: 'OEM part number' },
    { key: 'warrantyPeriod', label: 'Warranty', type: 'text', placeholder: 'e.g., 12 months' },
    { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
  ],
  service: [
    { key: 'serviceType', label: 'Service Type', type: 'text', placeholder: 'e.g., Repair, Maintenance' },
    { key: 'billingUnit', label: 'Billing Unit', type: 'select', options: [
      { value: 'per_hour', label: 'Per Hour' },
      { value: 'per_day', label: 'Per Day' },
      { value: 'fixed', label: 'Fixed Charge' },
    ]},
    { key: 'technicianName', label: 'Technician Name', type: 'text', placeholder: 'Technician name' },
  ],
  hardware_cement: [
    { key: 'weight', label: 'Weight', type: 'text', placeholder: 'e.g., 50 kg' },
    { key: 'brand', label: 'Brand', type: 'text', placeholder: 'Brand name' },
    { key: 'grade', label: 'Grade', type: 'text', placeholder: 'e.g., OPC 43' },
  ],
  custom: [],
};

// Get IndustryType from BusinessType for backward compatibility
export const getIndustryTypeFromBusinessType = (businessType?: BusinessType): IndustryType => {
  switch (businessType) {
    case 'pharmacy_medical': return 'medical';
    case 'retail_garments': return 'retail';
    case 'electronics_mobile': return 'electronics';
    case 'automobile': return 'automobile';
    case 'hardware_cement': return 'hardware';
    case 'service': return 'services';
    default: return 'retail';
  }
};

export interface Customer {
  name: string;
  billingAddress: string;
  mobile: string;
  district: string;
  village: string;
  gstNumber?: string;
  // Dynamic custom fields from template schema
  customFields?: Record<string, string | number | boolean>;
}

// Customer Database Entry (for Party Management)
export interface CustomerData {
  id: string;
  name: string;
  mobile: string;
  gstNumber?: string;
  email?: string;
  village: string;
  district: string;
  billingAddress: string;
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  description?: string;
  hsnCode: string;
  gstPercent: number;
  quantity: number;
  unitPrice: number;
  // Fields controlled by template settings
  batchNumber?: string;      // For medical templates
  expiryDate?: string;       // For medical templates (format: MM/YYYY)
  discount?: number;         // Discount percentage
  mrp?: number;              // MRP for medical
  partNumber?: string;       // For automobile templates
  vehicleModel?: string;     // For automobile templates
  warrantyMonths?: number;   // Warranty period
  wattage?: number;          // For solar templates
  sacCode?: string;          // For services templates
  serialNumber?: string;     // For electronics - Serial Number / IMEI
  notes?: string;            // Additional notes for the line item
  // Manual amount override
  manualAmount?: number;     // User-specified amount (overrides calculated)
  isManualAmount?: boolean;  // Flag to track if amount was manually set
  // Dynamic custom fields from template schema
  customFields?: Record<string, string | number | boolean>;
  // NEW: Dynamic attributes carried from product catalog
  attributes?: Record<string, string | number | boolean>;
}

// Industry Types for Dynamic Forms
export type IndustryType =
  | 'retail'
  | 'medical'
  | 'solar'
  | 'automobile'
  | 'electronics'
  | 'hardware'
  | 'cement'
  | 'electrical'
  | 'services'
  | 'custom';

// Unit Types
export type UnitType =
  | 'piece'
  | 'box'
  | 'packet'
  | 'strip'
  | 'bottle'
  | 'kg'
  | 'gram'
  | 'liter'
  | 'meter'
  | 'feet'
  | 'bag'
  | 'ton'
  | 'set'
  | 'service'
  | 'hour'
  | 'day'
  | 'custom';

// Expiry Status
export type ExpiryStatus = 'safe' | 'expiring_soon' | 'expired';

// Universal Product Catalog Item
export interface ProductCatalogItem {
  id: string;
  name: string;
  sku?: string;                    // SKU / Item Code
  category: string;                // Product Category
  unit: UnitType;                  // Unit Type
  purchasePrice: number;           // Purchase Price
  sellingPrice: number;            // Selling Price
  gstPercent: number;             // GST %
  hsnCode: string;                // HSN/SAC Code
  stockQuantity: number;           // Stock Quantity
  minStockAlert?: number;          // Minimum Stock Alert Level
  brand?: string;                 // Brand (optional)
  description?: string;           // Notes/Description
  // Expiry Tracking Fields (optional)
  batchNumber?: string;
  manufacturingDate?: string;      // Format: YYYY-MM-DD
  expiryDate?: string;            // Format: YYYY-MM-DD
  // Industry-specific fields
  industryType?: IndustryType;
  // Automobile fields
  partNumber?: string;
  modelNumber?: string;
  variant?: string;
  warrantyMonths?: number;
  // Electronics fields
  serialNumber?: string;
  // Solar fields
  wattage?: number;
  // Service fields
  sacCode?: string;
  billingUnit?: 'per_hour' | 'fixed' | 'per_day';
  serviceDuration?: number;
  // Custom fields for flexibility
  customFields?: Record<string, string | number | boolean>;
  // NEW: Dynamic attributes based on business type (JSON field)
  attributes?: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

// Unit Options for Dropdown
export const UNIT_OPTIONS: { value: UnitType; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'box', label: 'Box' },
  { value: 'packet', label: 'Packet' },
  { value: 'strip', label: 'Strip' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'kg', label: 'Kg' },
  { value: 'gram', label: 'Gram' },
  { value: 'liter', label: 'Liter' },
  { value: 'meter', label: 'Meter' },
  { value: 'feet', label: 'Feet' },
  { value: 'bag', label: 'Bag' },
  { value: 'ton', label: 'Ton' },
  { value: 'set', label: 'Set' },
  { value: 'service', label: 'Service' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
];

// Industry Type Options for Dropdown
export const INDUSTRY_OPTIONS: { value: IndustryType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'medical', label: 'Medical / Pharmacy' },
  { value: 'solar', label: 'Solar' },
  { value: 'automobile', label: 'Automobile' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'cement', label: 'Cement' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'services', label: 'Service Business' },
  { value: 'custom', label: 'Custom' },
];

// Industry-specific field configurations
export const INDUSTRY_FIELDS: Record<IndustryType, { fields: string[]; labels: Record<string, string> }> = {
  retail: {
    fields: ['sku', 'brand', 'unit'],
    labels: { sku: 'Barcode/SKU', brand: 'Brand', unit: 'Unit' },
  },
  medical: {
    fields: ['batchNumber', 'manufacturingDate', 'expiryDate', 'brand'],
    labels: { batchNumber: 'Batch Number', manufacturingDate: 'Mfg Date', expiryDate: 'Expiry Date', brand: 'Brand' },
  },
  solar: {
    fields: ['wattage', 'brand', 'modelNumber', 'warrantyMonths'],
    labels: { wattage: 'Wattage (W)', brand: 'Brand', modelNumber: 'Model Number', warrantyMonths: 'Warranty (Years)' },
  },
  automobile: {
    fields: ['partNumber', 'modelNumber', 'variant', 'brand', 'warrantyMonths'],
    labels: { partNumber: 'Part Number', modelNumber: 'Model Number', variant: 'Variant', brand: 'Brand', warrantyMonths: 'Warranty (Months)' },
  },
  electronics: {
    fields: ['serialNumber', 'modelNumber', 'brand', 'warrantyMonths'],
    labels: { serialNumber: 'Serial Number', modelNumber: 'Model Number', brand: 'Brand', warrantyMonths: 'Warranty (Months)' },
  },
  hardware: {
    fields: ['brand', 'unit'],
    labels: { brand: 'Brand', unit: 'Unit' },
  },
  cement: {
    fields: ['brand', 'unit', 'batchNumber'],
    labels: { brand: 'Brand', unit: 'Unit', batchNumber: 'Batch Number' },
  },
  electrical: {
    fields: ['brand', 'modelNumber', 'warrantyMonths'],
    labels: { brand: 'Brand', modelNumber: 'Model Number', warrantyMonths: 'Warranty (Months)' },
  },
  services: {
    fields: ['sacCode', 'billingUnit', 'serviceDuration'],
    labels: { sacCode: 'SAC Code', billingUnit: 'Billing Unit', serviceDuration: 'Duration' },
  },
  custom: {
    fields: [],
    labels: {},
  },
};

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
  // Dynamic fields controlled by template settings
  notes?: string;           // Notes field
  signature?: string;       // Signature image URL
  paymentQr?: string;       // QR Code image URL
  terms?: string;           // Custom terms & conditions
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
  signature?: string;       // Signature image URL
  paymentQr?: string;       // QR Code image URL
  terms?: string;           // Custom terms & conditions
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
  | 'divider'
  | 'warranty'
  | 'transport_details'
  | 'delivery_details'
  | 'installation_details';

// Dynamic zone IDs where custom blocks can be inserted
// Supports horizontal, vertical, split, and nested zones
export type BlockZone =
  // Horizontal flow zones (full width)
  | 'after_header'       // Between header and invoice details
  | 'after_meta'         // Between invoice details and party section
  | 'after_party'        // Between party section and product table
  | 'after_products'     // Between product table and totals
  | 'after_totals'       // Between totals and bank details
  | 'after_bank'         // Between bank details and signature
  | 'footer'              // At the very bottom before final strip
  // Split zones (side by side vertical columns)
  | 'party_left'         // Left side of party section (Bill To area)
  | 'party_right'        // Right side of party section (Ship To area)
  | 'bank_left'          // Left side of bank section
  | 'bank_right'         // Right side of bank/signature area
  // Footer split zones
  | 'footer_left'        // Left side of footer
  | 'footer_center'      // Center of footer
  | 'footer_right'       // Right side of footer
  // Legacy
  | 'canvas';            // Legacy: free-positioned on old block canvas

// Field types for dynamic form generation
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';

// Custom field definition for templates
export interface TemplateField {
  id: string;
  key: string;              // Used to store data: e.g., 'doctor_name', 'vehicle_model'
  label: string;            // Display label: e.g., 'Doctor Name', 'Vehicle Model'
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[]; // For select type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  // Where this field appears
  location: 'customer' | 'product' | 'quotation' | 'invoice';
  // Column width when in product table (percentage)
  columnWidth?: number;
}

// Industry-specific template schema
export interface TemplateSchema {
  // Industry category
  industry: 'solar' | 'medical' | 'automobile' | 'retail' | 'services' | 'general';

  // Product table columns - defines what columns appear in product table
  productColumns: TableColumn[];

  // Additional custom fields for products
  productFields: TemplateField[];

  // Additional custom fields for customer
  customerFields: TemplateField[];

  // Additional custom fields for quotation/invoice header
  documentFields: TemplateField[];

  // Default GST mode
  defaultGstMode?: GstMode;

  // Whether certain features are enabled
  features?: {
    enableShipTo?: boolean;
    enableDiscount?: boolean;
    enableBatchNumber?: boolean;
    enableExpiryDate?: boolean;
    enableWarranty?: boolean;
    enableInstallation?: boolean;
  };
}

export interface TemplateBlock {
  id: string;
  type: BlockType;
  zone: BlockZone;       // Which dynamic zone this block belongs to
  order: number;         // Order within the zone
  x?: number; // mm from left (only for canvas zone)
  y?: number; // mm from top (only for canvas zone)
  width?: number; // mm
  height?: number; // mm
  content?: string; // for text blocks
  style?: BlockStyle;
  visible: boolean;
  locked?: boolean;
  zIndex?: number;
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
// Typography element IDs for element-level control
export type TypographyElementId =
  | 'company_name'
  | 'company_address'
  | 'company_gstin'
  | 'company_phone'
  | 'company_email'
  | 'doc_title'
  | 'original_for_recipient'
  | 'quotation_number_label'
  | 'quotation_number_value'
  | 'quotation_date_label'
  | 'quotation_date_value'
  | 'invoice_number_label'
  | 'invoice_number_value'
  | 'invoice_date_label'
  | 'invoice_date_value'
  | 'due_date_label'
  | 'due_date_value'
  | 'po_number_label'
  | 'po_number_value'
  | 'eway_bill_label'
  | 'eway_bill_value'
  | 'vehicle_number_label'
  | 'vehicle_number_value'
  | 'bill_to_label'
  | 'bill_to_name'
  | 'bill_to_address'
  | 'bill_to_phone'
  | 'bill_to_gstin'
  | 'ship_to_label'
  | 'ship_to_name'
  | 'ship_to_address'
  | 'ship_to_phone'
  | 'ship_to_gstin'
  | 'table_header'
  | 'product_row'
  | 'product_description'
  | 'tax_summary_label'
  | 'tax_summary_row'
  | 'subtotal_label'
  | 'subtotal_value'
  | 'cgst_label'
  | 'cgst_value'
  | 'sgst_label'
  | 'sgst_value'
  | 'round_off_label'
  | 'round_off_value'
  | 'grand_total_label'
  | 'grand_total_value'
  | 'amount_in_words'
  | 'notes_label'
  | 'notes_value'
  | 'bank_details_label'
  | 'bank_details_content'
  | 'signature_label'
  | 'terms_label'
  | 'terms_content'
  | 'footer_strip'
  | 'custom_block';

// Typography metadata for individual elements
export interface TypographyElementMeta {
  id: TypographyElementId;
  fontSize: number;
  fontWeight: number;
  color: string;
  usesGlobal: boolean;
}

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
  showTaxSummary: boolean;
  // Header Layout
  headerAlignment: 'left' | 'center' | 'right';
  // Typography Colors
  headerTextColor: string;    // Company name, GSTIN, phone, email
  bodyTextColor: string;      // Customer name, address, product rows
  tableHeaderTextColor: string; // Items, HSN, Qty, Rate, Tax
  totalSectionColor: string;  // Subtotal, CGST, SGST, Grand Total
  // Typography Font Sizes (px)
  companyNameFontSize: number;
  companyDetailsFontSize: number;
  documentTitleFontSize: number;
  customerDetailsFontSize: number;
  tableHeaderFontSize: number;
  productRowFontSize: number;
  taxSummaryFontSize: number;
  totalSectionFontSize: number;
  grandTotalFontSize: number;
  termsFontSize: number;
  // Typography Font Weights
  headerFontWeight: number;
  bodyFontWeight: number;
  tableFontWeight: number;
  grandTotalFontWeight: number;
  // NEW: Global Default Font Size
  globalDefaultFontSize: number;
  // NEW: Element-level typography overrides
  typographyOverrides: Partial<Record<TypographyElementId, TypographyElementMeta>>;
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
  showTaxSummary: true,
  headerAlignment: 'left',
  headerTextColor: '#000000',
  bodyTextColor: '#000000',
  tableHeaderTextColor: '#000000',
  totalSectionColor: '#000000',
  companyNameFontSize: 28,
  companyDetailsFontSize: 14,
  documentTitleFontSize: 22,
  customerDetailsFontSize: 14,
  tableHeaderFontSize: 14,
  productRowFontSize: 13,
  taxSummaryFontSize: 13,
  totalSectionFontSize: 16,
  grandTotalFontSize: 26,
  termsFontSize: 12,
  headerFontWeight: 700,
  bodyFontWeight: 500,
  tableFontWeight: 600,
  grandTotalFontWeight: 700,
  // NEW defaults
  globalDefaultFontSize: 12,
  typographyOverrides: {},
};

// Default typography values for each element (used when resetting)
export const DEFAULT_TYPOGRAPHY_VALUES: Record<TypographyElementId, { fontSize: number; fontWeight: number; color: string }> = {
  company_name: { fontSize: 28, fontWeight: 700, color: '#000000' },
  company_address: { fontSize: 10, fontWeight: 400, color: '#000000' },
  company_gstin: { fontSize: 10, fontWeight: 700, color: '#000000' },
  company_phone: { fontSize: 10, fontWeight: 400, color: '#000000' },
  company_email: { fontSize: 10, fontWeight: 400, color: '#000000' },
  doc_title: { fontSize: 22, fontWeight: 700, color: '#000000' },
  original_for_recipient: { fontSize: 7.5, fontWeight: 400, color: '#000000' },
  quotation_number_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  quotation_number_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  quotation_date_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  quotation_date_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  invoice_number_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  invoice_number_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  invoice_date_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  invoice_date_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  due_date_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  due_date_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  po_number_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  po_number_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  eway_bill_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  eway_bill_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  vehicle_number_label: { fontSize: 8.5, fontWeight: 400, color: '#111111' },
  vehicle_number_value: { fontSize: 11, fontWeight: 700, color: '#000000' },
  bill_to_label: { fontSize: 14, fontWeight: 700, color: '#000000' },
  bill_to_name: { fontSize: 12, fontWeight: 700, color: '#000000' },
  bill_to_address: { fontSize: 14, fontWeight: 400, color: '#000000' },
  bill_to_phone: { fontSize: 10.5, fontWeight: 400, color: '#000000' },
  bill_to_gstin: { fontSize: 10.5, fontWeight: 400, color: '#000000' },
  ship_to_label: { fontSize: 14, fontWeight: 700, color: '#000000' },
  ship_to_name: { fontSize: 12, fontWeight: 700, color: '#000000' },
  ship_to_address: { fontSize: 14, fontWeight: 400, color: '#000000' },
  ship_to_phone: { fontSize: 10.5, fontWeight: 400, color: '#000000' },
  ship_to_gstin: { fontSize: 10.5, fontWeight: 400, color: '#000000' },
  table_header: { fontSize: 10.5, fontWeight: 700, color: '#000000' },
  product_row: { fontSize: 13, fontWeight: 500, color: '#000000' },
  product_description: { fontSize: 10, fontWeight: 400, color: '#000000' },
  tax_summary_label: { fontSize: 13, fontWeight: 600, color: '#000000' },
  tax_summary_row: { fontSize: 11, fontWeight: 400, color: '#000000' },
  subtotal_label: { fontSize: 16, fontWeight: 600, color: '#000000' },
  subtotal_value: { fontSize: 16, fontWeight: 500, color: '#000000' },
  cgst_label: { fontSize: 16, fontWeight: 600, color: '#000000' },
  cgst_value: { fontSize: 16, fontWeight: 500, color: '#000000' },
  sgst_label: { fontSize: 16, fontWeight: 600, color: '#000000' },
  sgst_value: { fontSize: 16, fontWeight: 500, color: '#000000' },
  round_off_label: { fontSize: 16, fontWeight: 600, color: '#000000' },
  round_off_value: { fontSize: 16, fontWeight: 500, color: '#000000' },
  grand_total_label: { fontSize: 26, fontWeight: 700, color: '#000000' },
  grand_total_value: { fontSize: 26, fontWeight: 700, color: '#000000' },
  amount_in_words: { fontSize: 9, fontWeight: 400, color: '#000000' },
  notes_label: { fontSize: 10.5, fontWeight: 700, color: '#000000' },
  notes_value: { fontSize: 10.5, fontWeight: 400, color: '#000000' },
  bank_details_label: { fontSize: 14, fontWeight: 700, color: '#000000' },
  bank_details_content: { fontSize: 10.5, fontWeight: 400, color: '#000000' },
  signature_label: { fontSize: 9, fontWeight: 400, color: '#000000' },
  terms_label: { fontSize: 10, fontWeight: 700, color: '#000000' },
  terms_content: { fontSize: 10, fontWeight: 400, color: '#000000' },
  footer_strip: { fontSize: 8.5, fontWeight: 400, color: '#AAAAAA' },
  custom_block: { fontSize: 10, fontWeight: 400, color: '#000000' },
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
  // NEW: Template schema for dynamic form generation
  schema?: TemplateSchema;
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

// ─── Supplier / Vendor Management ────────────────────────────────────────────

export type SupplierBalanceType = 'to_pay' | 'advance_paid';
export type SupplierTransactionType =
  | 'purchase_entry'
  | 'payment_made'
  | 'purchase_return'
  | 'debit_note'
  | 'credit_note'
  | 'opening_balance';

export type SupplierPaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'cheque';

export interface SupplierData {
  id: string;
  firmName: string;                   // Required: Company / Firm name
  contactPerson?: string;             // Optional: Contact person name
  mobile?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  openingBalance: number;             // Opening balance amount
  openingBalanceType: SupplierBalanceType; // to_pay or advance_paid
  paymentTerms?: string;              // e.g., 30 Days, 7 Days
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  date: string;
  type: SupplierTransactionType;
  referenceNumber?: string;
  description: string;
  purchaseAmount: number;             // Money owed to supplier (debit)
  paymentMade: number;               // Money paid to supplier (credit)
  paymentMethod?: SupplierPaymentMethod;
  runningBalance: number;             // Calculated running balance (positive = we owe)
  notes?: string;
  createdAt: string;
}

export const PAYMENT_TERMS_OPTIONS = [
  'Immediate',
  '7 Days',
  '15 Days',
  '30 Days',
  '45 Days',
  '60 Days',
  '90 Days',
  'Custom',
];

// ─── End Supplier / Vendor Management ────────────────────────────────────────

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
