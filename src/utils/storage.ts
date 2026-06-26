import { CompanyProfile, Product, ProductCatalogItem, Quotation, QuotationTemplate, TableColumn, BlockType, Invoice, NumberingSettings, TemplateBlock } from '../types';

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
    productColumns: quotation.productColumns,
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
  const now = new Date().toISOString();
  const stdCols = getDefaultProductColumns();

  // Template 2: Tally/Vyapar style - full borders, company left, quote number right
  const tallyCols = getDefaultProductColumns();
  const tallyBlocks: TemplateBlock[] = [
    { id: 't2_rect_outer', type: 'rectangle', x: 8, y: 8, width: 194, height: 281, visible: true, style: { borderWidth: 1, borderColor: '#000000', filled: false, borderRadius: 0 } },
    { id: 't2_hline_top', type: 'horizontal_line', x: 8, y: 38, width: 194, height: 2, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't2_vline_hdr', type: 'vertical_line', x: 105, y: 8, width: 2, height: 30, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't2_logo', type: 'company_logo', x: 12, y: 12, width: 25, height: 20, visible: true },
    { id: 't2_company', type: 'company_details', x: 40, y: 12, width: 60, height: 22, visible: true },
    { id: 't2_qtn_no', type: 'quotation_number', x: 110, y: 12, width: 88, height: 10, visible: true },
    { id: 't2_qtn_date', type: 'quotation_date', x: 110, y: 24, width: 88, height: 10, visible: true },
    { id: 't2_hline_cust', type: 'horizontal_line', x: 8, y: 68, width: 194, height: 2, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't2_customer', type: 'customer_details', x: 12, y: 42, width: 90, height: 25, visible: true },
    { id: 't2_vline_cust', type: 'vertical_line', x: 105, y: 38, width: 2, height: 30, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't2_text_party', type: 'text_block', x: 110, y: 42, width: 88, height: 8, visible: true, content: 'Party Details' },
    { id: 't2_products', type: 'product_table', x: 10, y: 72, width: 190, height: 80, visible: true },
    { id: 't2_hline_mid', type: 'horizontal_line', x: 8, y: 155, width: 194, height: 2, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't2_gst', type: 'gst_summary', x: 10, y: 158, width: 110, height: 30, visible: true },
    { id: 't2_totals', type: 'totals', x: 125, y: 158, width: 75, height: 30, visible: true },
    { id: 't2_hline_bank', type: 'horizontal_line', x: 8, y: 195, width: 194, height: 2, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't2_bank', type: 'bank_details', x: 12, y: 200, width: 90, height: 25, visible: true },
    { id: 't2_terms', type: 'terms_conditions', x: 12, y: 230, width: 90, height: 35, visible: true },
    { id: 't2_signature', type: 'signature_box', x: 130, y: 225, width: 65, height: 35, visible: true },
    { id: 't2_footer', type: 'footer_notes', x: 10, y: 270, width: 190, height: 10, visible: true },
  ];

  // Template 3: Minimal - clean, few dividers
  const minimalBlocks: TemplateBlock[] = [
    { id: 't3_company', type: 'company_details', x: 10, y: 15, width: 120, height: 25, visible: true },
    { id: 't3_qtn_no', type: 'quotation_number', x: 145, y: 15, width: 55, height: 10, visible: true },
    { id: 't3_qtn_date', type: 'quotation_date', x: 145, y: 28, width: 55, height: 10, visible: true },
    { id: 't3_divider1', type: 'divider', x: 10, y: 45, width: 190, height: 4, visible: true, style: { thickness: 1, color: '#cccccc' } },
    { id: 't3_customer', type: 'customer_details', x: 10, y: 52, width: 100, height: 25, visible: true },
    { id: 't3_products', type: 'product_table', x: 10, y: 82, width: 190, height: 80, visible: true },
    { id: 't3_totals', type: 'totals', x: 120, y: 168, width: 80, height: 30, visible: true },
    { id: 't3_divider2', type: 'divider', x: 10, y: 205, width: 190, height: 4, visible: true, style: { thickness: 1, color: '#cccccc' } },
    { id: 't3_bank', type: 'bank_details', x: 10, y: 212, width: 90, height: 20, visible: true },
    { id: 't3_signature', type: 'signature_box', x: 140, y: 212, width: 60, height: 25, visible: true },
    { id: 't3_footer', type: 'footer_notes', x: 10, y: 250, width: 190, height: 10, visible: true },
  ];

  // Template 4: Solar Installation - panel/inverter/subsidy/system size sections
  const solarBlocks: TemplateBlock[] = [
    { id: 't4_logo', type: 'company_logo', x: 10, y: 10, width: 28, height: 22, visible: true },
    { id: 't4_company', type: 'company_details', x: 42, y: 10, width: 100, height: 25, visible: true },
    { id: 't4_qtn_no', type: 'quotation_number', x: 150, y: 10, width: 50, height: 10, visible: true },
    { id: 't4_qtn_date', type: 'quotation_date', x: 150, y: 22, width: 50, height: 10, visible: true },
    { id: 't4_rect_sys', type: 'rectangle', x: 10, y: 40, width: 190, height: 20, visible: true, style: { borderWidth: 1, borderColor: '#f59e0b', filled: true, backgroundColor: '#fffbeb', borderRadius: 4 } },
    { id: 't4_text_sys', type: 'text_block', x: 14, y: 43, width: 182, height: 14, visible: true, content: 'System Size: {{system_size}} | Panel: {{panel_details}} | Inverter: {{inverter_details}}' },
    { id: 't4_customer', type: 'customer_details', x: 10, y: 65, width: 90, height: 25, visible: true },
    { id: 't4_rect_sub', type: 'rectangle', x: 110, y: 65, width: 90, height: 25, visible: true, style: { borderWidth: 1, borderColor: '#10b981', filled: true, backgroundColor: '#ecfdf5', borderRadius: 4 } },
    { id: 't4_text_sub', type: 'text_block', x: 114, y: 68, width: 82, height: 18, visible: true, content: 'Subsidy: {{subsidy_amount}}\nNet Price: {{net_price}}' },
    { id: 't4_products', type: 'product_table', x: 10, y: 95, width: 190, height: 80, visible: true },
    { id: 't4_gst', type: 'gst_summary', x: 10, y: 180, width: 110, height: 30, visible: true },
    { id: 't4_totals', type: 'totals', x: 130, y: 180, width: 70, height: 30, visible: true },
    { id: 't4_bank', type: 'bank_details', x: 10, y: 215, width: 90, height: 25, visible: true },
    { id: 't4_terms', type: 'terms_conditions', x: 10, y: 245, width: 90, height: 30, visible: true },
    { id: 't4_signature', type: 'signature_box', x: 140, y: 235, width: 60, height: 35, visible: true },
  ];

  // Template 5: Premium Modern - rounded sections, clean
  const premiumBlocks: TemplateBlock[] = [
    { id: 't5_rect_hdr', type: 'rectangle', x: 10, y: 10, width: 190, height: 35, visible: true, style: { borderWidth: 0, filled: true, backgroundColor: '#f0f4ff', borderRadius: 8 } },
    { id: 't5_logo', type: 'company_logo', x: 15, y: 14, width: 25, height: 22, visible: true },
    { id: 't5_company', type: 'company_details', x: 44, y: 14, width: 100, height: 25, visible: true },
    { id: 't5_qtn_no', type: 'quotation_number', x: 150, y: 16, width: 50, height: 10, visible: true },
    { id: 't5_qtn_date', type: 'quotation_date', x: 150, y: 28, width: 50, height: 10, visible: true },
    { id: 't5_rect_cust', type: 'rectangle', x: 10, y: 50, width: 90, height: 30, visible: true, style: { borderWidth: 0, filled: true, backgroundColor: '#f9fafb', borderRadius: 6 } },
    { id: 't5_customer', type: 'customer_details', x: 14, y: 53, width: 82, height: 25, visible: true },
    { id: 't5_rect_tot_top', type: 'rectangle', x: 110, y: 50, width: 90, height: 30, visible: true, style: { borderWidth: 0, filled: true, backgroundColor: '#f9fafb', borderRadius: 6 } },
    { id: 't5_text_summary', type: 'text_block', x: 114, y: 53, width: 82, height: 25, visible: true, content: 'Quotation Summary\n{{quotation_no}}\n{{date}}' },
    { id: 't5_products', type: 'product_table', x: 10, y: 85, width: 190, height: 80, visible: true },
    { id: 't5_gst', type: 'gst_summary', x: 10, y: 170, width: 110, height: 30, visible: true },
    { id: 't5_rect_totals', type: 'rectangle', x: 125, y: 170, width: 75, height: 30, visible: true, style: { borderWidth: 0, filled: true, backgroundColor: '#f0f4ff', borderRadius: 6 } },
    { id: 't5_totals', type: 'totals', x: 128, y: 172, width: 70, height: 28, visible: true },
    { id: 't5_rect_bank', type: 'rectangle', x: 10, y: 205, width: 90, height: 28, visible: true, style: { borderWidth: 0, filled: true, backgroundColor: '#f9fafb', borderRadius: 6 } },
    { id: 't5_bank', type: 'bank_details', x: 14, y: 208, width: 82, height: 23, visible: true },
    { id: 't5_rect_sig', type: 'rectangle', x: 130, y: 205, width: 70, height: 28, visible: true, style: { borderWidth: 0, filled: true, backgroundColor: '#f9fafb', borderRadius: 6 } },
    { id: 't5_signature', type: 'signature_box', x: 134, y: 208, width: 62, height: 23, visible: true },
    { id: 't5_footer', type: 'footer_notes', x: 10, y: 250, width: 190, height: 10, visible: true },
  ];

  // Template 6: Service Quotation - no HSN, no quantity
  const serviceCols: TableColumn[] = [
    { id: 'svc_1', key: 'sno', label: '#', width: 8, visible: true, order: 0 },
    { id: 'svc_2', key: 'name', label: 'Service Description', width: 55, visible: true, order: 1 },
    { id: 'svc_3', key: 'gstPercent', label: 'GST%', width: 12, visible: true, order: 2 },
    { id: 'svc_4', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 3 },
    { id: 'svc_5', key: 'amount', label: 'Amount', width: 13, visible: true, order: 4 },
  ];
  const serviceBlocks: TemplateBlock[] = [
    { id: 't6_logo', type: 'company_logo', x: 10, y: 10, width: 28, height: 22, visible: true },
    { id: 't6_company', type: 'company_details', x: 42, y: 10, width: 110, height: 25, visible: true },
    { id: 't6_qtn_no', type: 'quotation_number', x: 155, y: 12, width: 45, height: 10, visible: true },
    { id: 't6_qtn_date', type: 'quotation_date', x: 155, y: 24, width: 45, height: 10, visible: true },
    { id: 't6_divider1', type: 'divider', x: 10, y: 40, width: 190, height: 4, visible: true, style: { thickness: 1, color: '#3b82f6' } },
    { id: 't6_customer', type: 'customer_details', x: 10, y: 48, width: 100, height: 25, visible: true },
    { id: 't6_text_svc', type: 'text_block', x: 120, y: 48, width: 80, height: 10, visible: true, content: 'Service Quotation' },
    { id: 't6_products', type: 'product_table', x: 10, y: 80, width: 190, height: 80, visible: true },
    { id: 't6_totals', type: 'totals', x: 120, y: 165, width: 80, height: 30, visible: true },
    { id: 't6_divider2', type: 'divider', x: 10, y: 200, width: 190, height: 4, visible: true, style: { thickness: 1, color: '#3b82f6' } },
    { id: 't6_bank', type: 'bank_details', x: 10, y: 208, width: 90, height: 22, visible: true },
    { id: 't6_terms', type: 'terms_conditions', x: 10, y: 235, width: 90, height: 30, visible: true },
    { id: 't6_signature', type: 'signature_box', x: 140, y: 225, width: 60, height: 35, visible: true },
  ];

  // Template 7: Wholesale Dealer - large table, discount column, transport charges
  const wholesaleCols: TableColumn[] = [
    { id: 'whl_1', key: 'sno', label: '#', width: 6, visible: true, order: 0 },
    { id: 'whl_2', key: 'name', label: 'Product Name', width: 30, visible: true, order: 1 },
    { id: 'whl_3', key: 'hsnCode', label: 'HSN', width: 10, visible: true, order: 2 },
    { id: 'whl_4', key: 'gstPercent', label: 'GST%', width: 8, visible: true, order: 3 },
    { id: 'whl_5', key: 'quantity', label: 'Qty', width: 8, visible: true, order: 4 },
    { id: 'whl_6', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 5 },
    { id: 'whl_7', key: 'amount', label: 'Amount', width: 12, visible: true, order: 6 },
  ];
  const wholesaleBlocks: TemplateBlock[] = [
    { id: 't7_logo', type: 'company_logo', x: 10, y: 10, width: 25, height: 20, visible: true },
    { id: 't7_company', type: 'company_details', x: 38, y: 10, width: 100, height: 22, visible: true },
    { id: 't7_qtn_no', type: 'quotation_number', x: 145, y: 10, width: 55, height: 10, visible: true },
    { id: 't7_qtn_date', type: 'quotation_date', x: 145, y: 22, width: 55, height: 10, visible: true },
    { id: 't7_hline1', type: 'horizontal_line', x: 10, y: 36, width: 190, height: 2, visible: true, style: { thickness: 2, color: '#000000' } },
    { id: 't7_text_dealer', type: 'text_block', x: 10, y: 40, width: 190, height: 8, visible: true, content: 'WHOLESALE DEALER QUOTATION' },
    { id: 't7_customer', type: 'customer_details', x: 10, y: 52, width: 90, height: 22, visible: true },
    { id: 't7_rect_transport', type: 'rectangle', x: 110, y: 52, width: 90, height: 22, visible: true, style: { borderWidth: 1, borderColor: '#000000', filled: false, borderRadius: 0 } },
    { id: 't7_text_transport', type: 'text_block', x: 114, y: 55, width: 82, height: 16, visible: true, content: 'Transport Charges: {{transport_charges}}\nDelivery: {{delivery_terms}}' },
    { id: 't7_products', type: 'product_table', x: 10, y: 78, width: 190, height: 100, visible: true },
    { id: 't7_gst', type: 'gst_summary', x: 10, y: 182, width: 110, height: 30, visible: true },
    { id: 't7_totals', type: 'totals', x: 130, y: 182, width: 70, height: 30, visible: true },
    { id: 't7_hline2', type: 'horizontal_line', x: 10, y: 215, width: 190, height: 2, visible: true, style: { thickness: 1, color: '#000000' } },
    { id: 't7_bank', type: 'bank_details', x: 10, y: 220, width: 90, height: 22, visible: true },
    { id: 't7_terms', type: 'terms_conditions', x: 10, y: 245, width: 100, height: 30, visible: true },
    { id: 't7_signature', type: 'signature_box', x: 140, y: 235, width: 60, height: 35, visible: true },
  ];

  return [
    {
      id: 'tpl_professional_default',
      name: 'Professional Corporate',
      description: 'Default professional template for solar quotations',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
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
    },
    {
      id: 'tpl_tally_vyapar',
      name: 'Tally / Vyapar Style',
      description: 'Full table borders with horizontal and vertical dividers, company left, quotation right',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      productColumns: tallyCols,
      blocks: tallyBlocks,
    },
    {
      id: 'tpl_minimal_clean',
      name: 'Minimal Clean',
      description: 'Simple clean layout with minimal dividers',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      productColumns: getDefaultProductColumns(),
      blocks: minimalBlocks,
    },
    {
      id: 'tpl_solar_installation',
      name: 'Solar Installation',
      description: 'Panel details, inverter details, subsidy section, and system size section',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      productColumns: getDefaultProductColumns(),
      blocks: solarBlocks,
    },
    {
      id: 'tpl_premium_modern',
      name: 'Premium Modern',
      description: 'Clean modern layout with rounded sections and professional styling',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      productColumns: getDefaultProductColumns(),
      blocks: premiumBlocks,
    },
    {
      id: 'tpl_service_quotation',
      name: 'Service Quotation',
      description: 'Service-based layout with no HSN code and no quantity column',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      productColumns: serviceCols,
      blocks: serviceBlocks,
    },
    {
      id: 'tpl_wholesale_dealer',
      name: 'Wholesale Dealer',
      description: 'Large product table with transport charges section',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      productColumns: wholesaleCols,
      blocks: wholesaleBlocks,
    },
  ];
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
