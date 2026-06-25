import { CompanyProfile, Product, ProductCatalogItem, Quotation, QuotationTemplate, TableColumn, BlockType, Invoice, NumberingSettings } from '../types';

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
    return data ? JSON.parse(data) : getDefaultTemplates();
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: false,
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
    products: quotation.products.map(p => ({ ...p })),
    totalAmount: quotation.totalAmount,
    totalCgst: quotation.totalCgst,
    totalSgst: quotation.totalSgst,
    grandTotal: quotation.grandTotal,
    status: 'Unpaid',
    sourceQuotationId: quotation.id,
    sourceQuotationNumber: quotation.quotationNumber,
    selectedTemplateId: quotation.selectedTemplateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const getDefaultProducts = (): ProductCatalogItem[] => {
  return [
    { id: generateId(), name: 'Solar Panel 335W', hsnCode: '8541', gstPercent: 12, defaultPrice: 12000, createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Solar Panel 550W', hsnCode: '8541', gstPercent: 12, defaultPrice: 18000, createdAt: new Date().toISOString() },
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
  const templateId = generateId();
  return [{
    id: templateId,
    name: 'Professional Solar Quotation',
    description: 'Default professional template for solar quotations',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    productColumns: getDefaultProductColumns(),
    blocks: [
      { id: 'block_logo', type: 'company_logo' as BlockType, x: 10, y: 10, width: 30, height: 25, visible: true },
      { id: 'block_company', type: 'company_details' as BlockType, x: 45, y: 10, width: 110, height: 30, visible: true },
      { id: 'block_qtn_no', type: 'quotation_number' as BlockType, x: 160, y: 10, width: 40, height: 12, visible: true },
      { id: 'block_qtn_date', type: 'quotation_date' as BlockType, x: 160, y: 24, width: 40, height: 12, visible: true },
      { id: 'block_customer', type: 'customer_details' as BlockType, x: 10, y: 45, width: 90, height: 35, visible: true },
      { id: 'block_products', type: 'product_table' as BlockType, x: 10, y: 85, width: 190, height: 80, visible: true },
      { id: 'block_gst', type: 'gst_summary' as BlockType, x: 10, y: 170, width: 110, height: 30, visible: true },
      { id: 'block_totals', type: 'totals' as BlockType, x: 130, y: 170, width: 70, height: 30, visible: true },
      { id: 'block_bank', type: 'bank_details' as BlockType, x: 10, y: 210, width: 100, height: 25, visible: true },
      { id: 'block_terms', type: 'terms_conditions' as BlockType, x: 10, y: 240, width: 100, height: 35, visible: true },
      { id: 'block_signature', type: 'signature_box' as BlockType, x: 140, y: 230, width: 60, height: 35, visible: true },
    ],
  }];
};

export const calculateProductAmount = (product: Product): number => {
  return product.quantity * product.unitPrice;
};

export const calculateTaxSummary = (products: Product[]): Map<string, { taxableAmount: number; cgstAmount: number; sgstAmount: number; cgstRate: number; sgstRate: number }> => {
  const summary = new Map<string, { taxableAmount: number; cgstAmount: number; sgstAmount: number; cgstRate: number; sgstRate: number }>();

  products.forEach(product => {
    const key = `${product.hsnCode}_${product.gstPercent}`;
    const amount = calculateProductAmount(product);
    const cgstRate = product.gstPercent / 2;
    const sgstRate = product.gstPercent / 2;
    const cgstAmount = (amount * cgstRate) / 100;
    const sgstAmount = (amount * sgstRate) / 100;

    if (summary.has(key)) {
      const existing = summary.get(key)!;
      existing.taxableAmount += amount;
      existing.cgstAmount += cgstAmount;
      existing.sgstAmount += sgstAmount;
    } else {
      summary.set(key, {
        taxableAmount: amount,
        cgstRate,
        sgstRate,
        cgstAmount,
        sgstAmount,
      });
    }
  });

  return summary;
};
