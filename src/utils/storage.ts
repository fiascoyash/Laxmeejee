import {
  CompanyProfile, Product, ProductCatalogItem, Quotation, QuotationTemplate, TableColumn,
  BlockType, Invoice, NumberingSettings, TemplateBlock, GstMode, TemplateSettings,
  DEFAULT_TEMPLATE_SETTINGS, TemplateCategory, ThemeId
} from '../types';

const STORAGE_KEYS = {
  COMPANY_PROFILE: 'solar_company_profile',
  QUOTATIONS: 'solar_quotations',
  PRODUCT_CATALOG: 'solar_product_catalog',
  TEMPLATES: 'solar_quotation_templates',
  INVOICES: 'solar_invoices',
  NUMBERING: 'solar_numbering_settings',
};

const getDefaultNumberingSettings = (): NumberingSettings => ({
  quotationPrefix: 'QT',
  quotationIncludeYear: true,
  quotationStartNumber: 1,
  quotationAutoIncrement: true,
  quotationNextNumber: 1,
  invoicePrefix: 'INV',
  invoiceIncludeYear: true,
  invoiceStartNumber: 1,
  invoiceAutoIncrement: true,
  invoiceNextNumber: 1,
});

export const storage = {
  // Company Profile
  getCompanyProfile: (): CompanyProfile => {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANY_PROFILE);
    return data ? JSON.parse(data) : {
      companyName: 'Solar Energy Solutions Pvt Ltd',
      logo: '',
      gstNumber: '',
      address: '',
      email: '',
      phone: '',
      bankName: '',
      bankAccount: '',
      bankIfsc: '',
      bankBranch: '',
      signature: '',
    };
  },

  saveCompanyProfile: (profile: CompanyProfile): void => {
    localStorage.setItem(STORAGE_KEYS.COMPANY_PROFILE, JSON.stringify(profile));
  },

  // Quotations
  getQuotations: (): Quotation[] => {
    const data = localStorage.getItem(STORAGE_KEYS.QUOTATIONS);
    return data ? JSON.parse(data) : [];
  },

  saveQuotation: (quotation: Quotation): void => {
    const quotations = storage.getQuotations();
    const existingIndex = quotations.findIndex(q => q.id === quotation.id);
    if (existingIndex >= 0) {
      quotations[existingIndex] = quotation;
    } else {
      quotations.unshift(quotation);
    }
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotations));
  },

  deleteQuotation: (id: string): void => {
    const quotations = storage.getQuotations().filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUOTATIONS, JSON.stringify(quotations));
  },

  duplicateQuotation: (id: string): Quotation | null => {
    const quotations = storage.getQuotations();
    const original = quotations.find(q => q.id === id);
    if (!original) return null;

    const newQuotation: Quotation = {
      ...original,
      id: generateId(),
      quotationNumber: generateQuotationNumber(),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    storage.saveQuotation(newQuotation);
    return newQuotation;
  },

  // Product Catalog
  getProductCatalog: (): ProductCatalogItem[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCT_CATALOG);
    return data ? JSON.parse(data) : getDefaultProducts();
  },

  saveProductCatalog: (products: ProductCatalogItem[]): void => {
    localStorage.setItem(STORAGE_KEYS.PRODUCT_CATALOG, JSON.stringify(products));
  },

  addCatalogProduct: (product: ProductCatalogItem): void => {
    const catalog = storage.getProductCatalog();
    catalog.push(product);
    storage.saveProductCatalog(catalog);
  },

  updateCatalogProduct: (product: ProductCatalogItem): void => {
    const catalog = storage.getProductCatalog();
    const index = catalog.findIndex(p => p.id === product.id);
    if (index >= 0) {
      catalog[index] = product;
      storage.saveProductCatalog(catalog);
    }
  },

  deleteCatalogProduct: (id: string): void => {
    const catalog = storage.getProductCatalog().filter(p => p.id !== id);
    storage.saveProductCatalog(catalog);
  },

  // Templates
  getTemplates: (): QuotationTemplate[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!data) return getDefaultTemplates();
    const stored: QuotationTemplate[] = JSON.parse(data);
    const defaults = getDefaultTemplates();
    const existingIds = new Set(stored.map(t => t.id));
    const missing = defaults.filter(t => !existingIds.has(t.id));
    if (missing.length > 0) {
      const merged = [...stored, ...missing];
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(merged));
      return merged;
    }
    return stored;
  },

  saveTemplates: (templates: QuotationTemplate[]): void => {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
  },

  saveTemplate: (template: QuotationTemplate): void => {
    const templates = storage.getTemplates();
    const existingIndex = templates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      templates[existingIndex] = { ...template, updatedAt: new Date().toISOString() };
    } else {
      templates.push(template);
    }
    storage.saveTemplates(templates);
  },

  deleteTemplate: (id: string): void => {
    const templates = storage.getTemplates().filter(t => t.id !== id);
    storage.saveTemplates(templates);
  },

  duplicateTemplate: (id: string): QuotationTemplate | null => {
    const templates = storage.getTemplates();
    const original = templates.find(t => t.id === id);
    if (!original) return null;

    const newTemplate: QuotationTemplate = {
      ...original,
      id: generateId(),
      name: `${original.name} (Copy)`,
      category: original.category || 'professional',
      themeId: (original as any).themeId || 'simple',
      settings: { ...original.settings },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: false,
      isPremium: false,
    };

    storage.saveTemplate(newTemplate);
    return newTemplate;
  },

  getDefaultTemplate: (): QuotationTemplate | undefined => {
    const templates = storage.getTemplates();
    return templates.find(t => t.isDefault) || templates[0];
  },

  getTemplateById: (id: string): QuotationTemplate | undefined => {
    const templates = storage.getTemplates();
    return templates.find(t => t.id === id);
  },

  // Numbering Settings
  getNumberingSettings: (): NumberingSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.NUMBERING);
    return data ? { ...getDefaultNumberingSettings(), ...JSON.parse(data) } : getDefaultNumberingSettings();
  },

  saveNumberingSettings: (settings: NumberingSettings): void => {
    localStorage.setItem(STORAGE_KEYS.NUMBERING, JSON.stringify(settings));
  },

  // Invoices
  getInvoices: (): Invoice[] => {
    const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
    return data ? JSON.parse(data) : [];
  },

  saveInvoice: (invoice: Invoice): void => {
    const invoices = storage.getInvoices();
    const existingIndex = invoices.findIndex(i => i.id === invoice.id);
    if (existingIndex >= 0) {
      invoices[existingIndex] = { ...invoice, updatedAt: new Date().toISOString() };
    } else {
      invoices.unshift(invoice);
    }
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },

  deleteInvoice: (id: string): void => {
    const invoices = storage.getInvoices().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  },

  duplicateInvoice: (id: string): Invoice | null => {
    const invoices = storage.getInvoices();
    const original = invoices.find(i => i.id === id);
    if (!original) return null;

    const newInvoice: Invoice = {
      ...original,
      id: generateId(),
      invoiceNumber: (() => { const n = generateInvoiceNumber(); incrementInvoiceNumber(); return n; })(),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'Draft',
      sourceQuotationId: undefined,
      sourceQuotationNumber: undefined,
    };

    storage.saveInvoice(newInvoice);
    return newInvoice;
  },

  getInvoiceById: (id: string): Invoice | undefined => {
    return storage.getInvoices().find(i => i.id === id);
  },
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const generateQuotationNumber = (): string => {
  const settings = storage.getNumberingSettings();
  const year = new Date().getFullYear();
  const num = settings.quotationNextNumber;
  const parts = [settings.quotationPrefix];
  if (settings.quotationIncludeYear) parts.push(String(year));
  parts.push(num.toString().padStart(3, '0'));
  return parts.join('-');
};

export const generateInvoiceNumber = (): string => {
  const settings = storage.getNumberingSettings();
  const year = new Date().getFullYear();
  const num = settings.invoiceNextNumber;
  const parts = [settings.invoicePrefix];
  if (settings.invoiceIncludeYear) parts.push(String(year));
  parts.push(num.toString().padStart(3, '0'));
  return parts.join('-');
};

export const incrementQuotationNumber = (): void => {
  const settings = storage.getNumberingSettings();
  if (settings.quotationAutoIncrement) {
    settings.quotationNextNumber = settings.quotationNextNumber + 1;
    storage.saveNumberingSettings(settings);
  }
};

export const incrementInvoiceNumber = (): void => {
  const settings = storage.getNumberingSettings();
  if (settings.invoiceAutoIncrement) {
    settings.invoiceNextNumber = settings.invoiceNextNumber + 1;
    storage.saveNumberingSettings(settings);
  }
};

export const convertQuotationToInvoice = (quotation: Quotation): Invoice => {
  const invoiceNumber = generateInvoiceNumber();
  incrementInvoiceNumber();
  return {
    id: generateId(),
    invoiceNumber,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customer: { ...quotation.customer },
    shipTo: quotation.shipTo ? { ...quotation.shipTo } : undefined,
    products: quotation.products.map(p => ({ ...p })),
    totalAmount: quotation.totalAmount,
    totalCgst: quotation.totalCgst,
    totalSgst: quotation.totalSgst,
    roundOff: quotation.roundOff || 0,
    grandTotal: quotation.grandTotal,
    status: 'Unpaid',
    sourceQuotationId: quotation.id,
    sourceQuotationNumber: quotation.quotationNumber,
    selectedTemplateId: quotation.selectedTemplateId,
    productColumns: quotation.productColumns,
    gstMode: quotation.gstMode || 'inclusive',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const getDefaultProducts = (): ProductCatalogItem[] => {
  return [
    { id: generateId(), name: 'Solar Panel 335W', hsnCode: '8541', gstPercent: 18, defaultPrice: 12000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Solar Panel 550W', hsnCode: '8541', gstPercent: 18, defaultPrice: 18000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Solar Inverter 3kW', hsnCode: '8504', gstPercent: 18, defaultPrice: 35000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Solar Inverter 5kW', hsnCode: '8504', gstPercent: 18, defaultPrice: 55000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Solar Battery 150Ah', hsnCode: '8507', gstPercent: 18, defaultPrice: 22000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Solar Structure (Per kW)', hsnCode: '7610', gstPercent: 18, defaultPrice: 8000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'DCDB Box', hsnCode: '8537', gstPercent: 18, defaultPrice: 3500, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'ACDB Box', hsnCode: '8537', gstPercent: 18, defaultPrice: 4500, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Cable 4 sq mm (Per Meter)', hsnCode: '8544', gstPercent: 18, defaultPrice: 45, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Earthing Kit', hsnCode: '8536', gstPercent: 18, defaultPrice: 5000, createdAt: new Date().toISOString() },
  ];
};

export const getDefaultProductColumns = (): TableColumn[] => [
  { id: 'col_1', key: 'sno', label: '#', width: 8, visible: true, order: 0 },
  { id: 'col_2', key: 'name', label: 'Product Name', width: 35, visible: true, order: 1 },
  { id: 'col_3', key: 'hsnCode', label: 'HSN', width: 12, visible: true, order: 2 },
  { id: 'col_4', key: 'gstPercent', label: 'GST%', width: 10, visible: true, order: 3 },
  { id: 'col_5', key: 'quantity', label: 'Qty', width: 10, visible: true, order: 4 },
  { id: 'col_6', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 5 },
  { id: 'col_7', key: 'amount', label: 'Amount', width: 13, visible: true, order: 6 },
];

const getDefaultTemplates = (): QuotationTemplate[] => {
  const now = new Date().toISOString();
  const stdCols = getDefaultProductColumns();

  // ==================== NEW FLOW-BASED TEMPLATES ====================
  // Each template uses themeId + settings for flow-based DocumentRenderer
  // No absolute positioning - sections stack vertically and reflow dynamically

  return [
    // Template 1: Luxury Gold Invoice
    {
      id: 'tpl_luxury_gold',
      name: 'Luxury Gold Invoice',
      description: 'Premium invoice with elegant gold borders, decorative corners, and sophisticated styling. Inspired by myBillBook premium templates.',
      category: 'luxury',
      themeId: 'luxury',
      isDefault: true,
      isPremium: true,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showPaymentQr: true,
        showSignature: true,
        showTermsConditions: true,
        showWatermark: false,
      },
    },
    // Template 2: Stylish Blue Invoice
    {
      id: 'tpl_stylish_blue',
      name: 'Stylish Blue Invoice',
      description: 'Modern blue header with professional styling. Clean and elegant for business use.',
      category: 'modern',
      themeId: 'stylish',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showNotes: true,
      },
    },
    // Template 3: Tally GST Professional
    {
      id: 'tpl_tally_gst',
      name: 'Tally GST Professional',
      description: 'Full borders with accounting-style layout, ledger-focused design. Perfect for tax-compliant documentation.',
      category: 'gst',
      themeId: 'tally',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showGstin: true,
        showTax: true,
        showBankDetails: true,
        showTermsConditions: true,
      },
    },
    // Template 4: Billbook Retail Invoice
    {
      id: 'tpl_billbook_retail',
      name: 'Billbook Retail Invoice',
      description: 'Dmart/Big Bazaar inspired layout with dense item table and accent bar styling.',
      category: 'retail',
      themeId: 'billbook',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showPhone: true,
        showGstin: true,
        showDiscount: true,
        showBankDetails: false,
        showSignature: false,
        showTermsConditions: false,
      },
    },
    // Template 5: Modern Corporate Invoice
    {
      id: 'tpl_modern_corporate',
      name: 'Modern Corporate Invoice',
      description: 'Clean modern header with professional styling. Perfect for business-to-business invoicing.',
      category: 'modern',
      themeId: 'modern',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showNotes: true,
      },
    },
    // Template 6: Simple Clean Invoice
    {
      id: 'tpl_simple_clean',
      name: 'Simple Clean Invoice',
      description: 'Pure white layout with elegant typography. Sophisticated simplicity.',
      category: 'modern',
      themeId: 'simple',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showTermsConditions: true,
        showNotes: true,
      },
    },
  ];
};

// Round to 2 decimal places - fixes floating point precision issues
export const roundTo2 = (value: number): number => {
  return Math.round(value * 100) / 100;
};

// Calculate base amount (quantity * unitPrice)
export const calculateProductAmount = (product: Product): number => {
  return roundTo2(product.quantity * product.unitPrice);
};

// Calculate grand total amount based on GST mode
// Inclusive: base amount is the final total (GST already included)
// Exclusive: base amount + GST = final total
export const calculateGrandTotalAmount = (products: Product[], gstMode: GstMode): number => {
  return roundTo2(products.reduce((sum, p) => {
    const baseAmount = calculateProductAmount(p);
    if (gstMode === 'inclusive' || p.gstPercent === 0) {
      return sum + baseAmount;
    } else {
      // Exclusive: add GST on top
      const gstAmount = roundTo2(baseAmount * (p.gstPercent / 100));
      return sum + baseAmount + gstAmount;
    }
  }, 0));
};

// Calculate taxable amount based on GST mode
// Inclusive: extract GST from price (Taxable = Amount / (1 + GST/100))
// Exclusive: the base amount IS the taxable amount
export const calculateTaxableAmount = (amount: number, gstPercent: number, gstMode: GstMode): number => {
  if (gstPercent === 0) return amount;
  if (gstMode === 'exclusive') return amount;
  // Inclusive mode: extract GST
  return roundTo2(amount / (1 + gstPercent / 100));
};

// Calculate GST amount based on mode
// Inclusive: GST = Amount - Taxable (extract from included)
// Exclusive: GST = Taxable * (GST/100) (add on top)
export const calculateGstAmount = (amount: number, gstPercent: number, gstMode: GstMode): number => {
  if (gstPercent === 0) return 0;
  if (gstMode === 'exclusive') {
    return roundTo2(amount * (gstPercent / 100));
  }
  // Inclusive mode: extract GST from amount
  const taxableAmount = calculateTaxableAmount(amount, gstPercent, gstMode);
  return roundTo2(amount - taxableAmount);
};

// Tax summary calculation - now supports both GST modes
export const calculateTaxSummary = (products: Product[], gstMode: GstMode = 'inclusive'): Map<string, { taxableAmount: number; cgstAmount: number; sgstAmount: number; cgstRate: number; sgstRate: number }> => {
  const summary = new Map<string, { taxableAmount: number; cgstAmount: number; sgstAmount: number; cgstRate: number; sgstRate: number }>();

  products.forEach(product => {
    const key = `${product.hsnCode}_${product.gstPercent}`;
    const baseAmount = calculateProductAmount(product);
    const cgstRate = product.gstPercent / 2;
    const sgstRate = product.gstPercent / 2;

    const taxableAmount = calculateTaxableAmount(baseAmount, product.gstPercent, gstMode);
    const gstAmount = calculateGstAmount(baseAmount, product.gstPercent, gstMode);
    const cgstAmount = roundTo2(gstAmount / 2);
    const sgstAmount = roundTo2(gstAmount / 2);

    if (summary.has(key)) {
      const existing = summary.get(key)!;
      existing.taxableAmount = roundTo2(existing.taxableAmount + taxableAmount);
      existing.cgstAmount = roundTo2(existing.cgstAmount + cgstAmount);
      existing.sgstAmount = roundTo2(existing.sgstAmount + sgstAmount);
    } else {
      summary.set(key, {
        taxableAmount,
        cgstRate,
        sgstRate,
        cgstAmount,
        sgstAmount,
      });
    }
  });

  return summary;
};

export const calculateRoundOff = (rawTotal: number): { roundOff: number; roundedGrandTotal: number } => {
  const roundedGrandTotal = Math.round(rawTotal);
  const roundOff = roundTo2(roundedGrandTotal - rawTotal);
  return { roundOff, roundedGrandTotal };
};

export const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertHundreds = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertHundreds(n % 100) : '');
  };

  const convertThousand = (n: number): string => {
    if (n < 1000) return convertHundreds(n);
    if (n < 100000) {
      const thousand = Math.floor(n / 1000);
      const remainder = n % 1000;
      return (thousand < 20 ? ones[thousand] : convertHundreds(thousand)) + ' Thousand' +
        (remainder !== 0 ? ' ' + convertHundreds(remainder) : '');
    }
    if (n < 10000000) {
      const lakh = Math.floor(n / 100000);
      const remainder = n % 100000;
      return (lakh < 20 ? ones[lakh] : convertHundreds(lakh)) + ' Lakh' +
        (remainder !== 0 ? ' ' + convertThousand(remainder) : '');
    }
    const crore = Math.floor(n / 10000000);
    const remainder = n % 10000000;
    return (crore < 20 ? ones[crore] : convertHundreds(crore)) + ' Crore' +
      (remainder !== 0 ? ' ' + convertThousand(remainder) : '');
  };

  const roundedNum = Math.round(num);
  return convertThousand(roundedNum) + ' Rupees Only';
};
