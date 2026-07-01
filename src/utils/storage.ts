import {
  CompanyProfile, Product, ProductCatalogItem, Quotation, QuotationTemplate, TableColumn,
  Invoice, NumberingSettings, GstMode, CustomerData,
  DEFAULT_TEMPLATE_SETTINGS, TemplateSchema, UnitType, IndustryType, ExpiryStatus, UNIT_OPTIONS,
  SupplierData, SupplierTransaction,
} from '../types';

const STORAGE_KEYS = {
  COMPANY_PROFILE: 'solar_company_profile',
  QUOTATIONS: 'solar_quotations',
  PRODUCT_CATALOG: 'solar_product_catalog',
  TEMPLATES: 'solar_quotation_templates',
  INVOICES: 'solar_invoices',
  NUMBERING: 'solar_numbering_settings',
  CUSTOMERS: 'solar_customers',
  SUPPLIERS: 'laxmeejee_suppliers',
  SUPPLIER_TRANSACTIONS: 'laxmeejee_supplier_transactions',
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
      settings: original.settings ? { ...original.settings } : undefined,
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

  // Customers (Party Management)
  getCustomers: (): CustomerData[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return data ? JSON.parse(data) : [];
  },

  saveCustomer: (customer: CustomerData): void => {
    const customers = storage.getCustomers();
    const existingIndex = customers.findIndex(c => c.id === customer.id);
    if (existingIndex >= 0) {
      customers[existingIndex] = { ...customer, updatedAt: new Date().toISOString() };
    } else {
      customers.unshift(customer);
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  deleteCustomer: (id: string): void => {
    const customers = storage.getCustomers().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  },

  getCustomerById: (id: string): CustomerData | undefined => {
    return storage.getCustomers().find(c => c.id === id);
  },

  getCustomerByMobile: (mobile: string): CustomerData | undefined => {
    return storage.getCustomers().find(c => c.mobile === mobile);
  },

  searchCustomers: (query: string): CustomerData[] => {
    const customers = storage.getCustomers();
    const lowerQuery = query.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.mobile.includes(query) ||
      (c.gstNumber && c.gstNumber.toLowerCase().includes(lowerQuery))
    );
  },

  getRecentCustomers: (limit: number = 5): CustomerData[] => {
    const customers = storage.getCustomers();
    return customers.slice(0, limit);
  },

  isCustomerExists: (mobile: string): boolean => {
    return storage.getCustomers().some(c => c.mobile === mobile);
  },

  // ─── Suppliers / Vendors ──────────────────────────────────────────────────

  getSuppliers: (): SupplierData[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
    return data ? JSON.parse(data) : [];
  },

  saveSupplier: (supplier: SupplierData): void => {
    const suppliers = storage.getSuppliers();
    const existingIndex = suppliers.findIndex(s => s.id === supplier.id);
    if (existingIndex >= 0) {
      suppliers[existingIndex] = { ...supplier, updatedAt: new Date().toISOString() };
    } else {
      suppliers.unshift(supplier);
    }
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
  },

  deleteSupplier: (id: string): void => {
    const suppliers = storage.getSuppliers().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers));
    // Also delete all transactions for this supplier
    const txns = storage.getSupplierTransactions().filter(t => t.supplierId !== id);
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TRANSACTIONS, JSON.stringify(txns));
  },

  getSupplierById: (id: string): SupplierData | undefined => {
    return storage.getSuppliers().find(s => s.id === id);
  },

  // Supplier Transactions
  getSupplierTransactions: (): SupplierTransaction[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SUPPLIER_TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  getSupplierTransactionsBySupplierId: (supplierId: string): SupplierTransaction[] => {
    return storage.getSupplierTransactions()
      .filter(t => t.supplierId === supplierId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  saveSupplierTransaction: (transaction: SupplierTransaction): void => {
    const txns = storage.getSupplierTransactions();
    const existingIndex = txns.findIndex(t => t.id === transaction.id);
    if (existingIndex >= 0) {
      txns[existingIndex] = transaction;
    } else {
      txns.push(transaction);
    }
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TRANSACTIONS, JSON.stringify(txns));
  },

  deleteSupplierTransaction: (id: string): void => {
    const txns = storage.getSupplierTransactions().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TRANSACTIONS, JSON.stringify(txns));
  },

  // Recalculate running balance for a supplier's transactions (call after any change)
  recalculateSupplierBalance: (supplierId: string): void => {
    const supplier = storage.getSupplierById(supplierId);
    if (!supplier) return;

    const txns = storage.getSupplierTransactions()
      .filter(t => t.supplierId === supplierId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Opening balance: positive = we owe supplier (to_pay), negative = advance
    let runningBalance = supplier.openingBalanceType === 'to_pay'
      ? supplier.openingBalance
      : -supplier.openingBalance;

    const updatedTxns = txns.map(t => {
      runningBalance += t.purchaseAmount - t.paymentMade;
      return { ...t, runningBalance };
    });

    const allTxns = storage.getSupplierTransactions().filter(t => t.supplierId !== supplierId);
    localStorage.setItem(STORAGE_KEYS.SUPPLIER_TRANSACTIONS, JSON.stringify([...allTxns, ...updatedTxns]));
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
  const now = new Date().toISOString();
  return [
    // Solar Products
    { id: generateId(), name: 'Solar Panel 335W', sku: 'SP-335', category: 'Solar', unit: 'piece', purchasePrice: 10000, sellingPrice: 12000, gstPercent: 18, hsnSacCode: '8541', stockQuantity: 50, minStockAlert: 10, brand: 'Waaree', wattage: 335, industryType: 'solar', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Solar Panel 550W', sku: 'SP-550', category: 'Solar', unit: 'piece', purchasePrice: 15000, sellingPrice: 18000, gstPercent: 18, hsnSacCode: '8541', stockQuantity: 30, minStockAlert: 5, brand: 'Waaree', wattage: 550, industryType: 'solar', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Solar Inverter 3kW', sku: 'SI-3K', category: 'Solar', unit: 'piece', purchasePrice: 28000, sellingPrice: 35000, gstPercent: 18, hsnSacCode: '8504', stockQuantity: 10, minStockAlert: 3, brand: 'Luminous', industryType: 'solar', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Solar Battery 150Ah', sku: 'SB-150', category: 'Solar', unit: 'piece', purchasePrice: 18000, sellingPrice: 22000, gstPercent: 18, hsnSacCode: '8507', stockQuantity: 15, minStockAlert: 5, brand: 'Exide', industryType: 'solar', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'DCDB Box', sku: 'DCDB-001', category: 'Solar', unit: 'piece', purchasePrice: 2500, sellingPrice: 3500, gstPercent: 18, hsnSacCode: '8537', stockQuantity: 20, minStockAlert: 5, industryType: 'solar', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'ACDB Box', sku: 'ACDB-001', category: 'Solar', unit: 'piece', purchasePrice: 3500, sellingPrice: 4500, gstPercent: 18, hsnSacCode: '8537', stockQuantity: 15, minStockAlert: 5, industryType: 'solar', createdAt: now, updatedAt: now },
    // Medical Products (Example)
    { id: generateId(), name: 'Paracetamol 500mg', sku: 'MED-P500', category: 'Medicine', unit: 'strip', purchasePrice: 15, sellingPrice: 20, gstPercent: 5, hsnSacCode: '3004', stockQuantity: 100, minStockAlert: 20, brand: 'Cipla', batchNumber: 'BTH001', expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], industryType: 'medical', createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Azithromycin 500mg', sku: 'MED-A500', category: 'Medicine', unit: 'strip', purchasePrice: 50, sellingPrice: 65, gstPercent: 5, hsnSacCode: '3004', stockQuantity: 50, minStockAlert: 10, brand: 'Sun Pharma', batchNumber: 'BTH002', expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], industryType: 'medical', createdAt: now, updatedAt: now },
  ];
};

export const getDefaultProductColumns = (): TableColumn[] => [
  { id: 'col_1', key: 'sno', label: '#', width: 8, visible: true, order: 0 },
  { id: 'col_2', key: 'name', label: 'Product Name', width: 35, visible: true, order: 1 },
  { id: 'col_3', key: 'hsnSacCode', label: 'HSN/SAC', width: 12, visible: false, order: 2 },
  { id: 'col_4', key: 'gstPercent', label: 'GST%', width: 10, visible: false, order: 3 },
  { id: 'col_5', key: 'quantity', label: 'Qty', width: 10, visible: true, order: 4 },
  { id: 'col_6', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 5 },
  { id: 'col_7', key: 'amount', label: 'Amount', width: 13, visible: true, order: 6 },
];

// ─── Industry-Specific Template Schemas ─────────────────────────────────────

// Solar Industry Schema
export const SOLAR_SCHEMA: TemplateSchema = {
  industry: 'solar',
  productColumns: [
    { id: 'col_1', key: 'sno', label: '#', width: 6, visible: true, order: 0 },
    { id: 'col_2', key: 'name', label: 'Product Name', width: 30, visible: true, order: 1 },
    { id: 'col_3', key: 'wattage', label: 'Wattage', width: 10, visible: true, order: 2 },
    { id: 'col_4', key: 'hsnSacCode', label: 'HSN/SAC', width: 10, visible: true, order: 3 },
    { id: 'col_5', key: 'gstPercent', label: 'GST%', width: 8, visible: true, order: 4 },
    { id: 'col_6', key: 'quantity', label: 'Qty', width: 8, visible: true, order: 5 },
    { id: 'col_7', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 6 },
    { id: 'col_8', key: 'amount', label: 'Amount', width: 12, visible: true, order: 7 },
  ],
  productFields: [
    {
      id: 'fld_wattage',
      key: 'wattage',
      label: 'Wattage (W)',
      type: 'number',
      required: false,
      placeholder: 'e.g., 335',
      location: 'product',
      columnWidth: 10,
    },
    {
      id: 'fld_installation',
      key: 'installationCharge',
      label: 'Installation',
      type: 'number',
      required: false,
      placeholder: 'Installation charges',
      location: 'product',
    },
  ],
  customerFields: [],
  documentFields: [
    {
      id: 'fld_net_meter',
      key: 'netMeterCharge',
      label: 'Net Meter Charge',
      type: 'number',
      required: false,
      placeholder: 'Net metering charges',
      location: 'quotation',
    },
    {
      id: 'fld_site_survey',
      key: 'siteSurveyDate',
      label: 'Site Survey Date',
      type: 'date',
      required: false,
      location: 'quotation',
    },
  ],
  defaultGstMode: 'inclusive',
  features: {
    enableShipTo: true,
    enableInstallation: true,
  },
};

// Medical/Pharmacy Schema
export const MEDICAL_SCHEMA: TemplateSchema = {
  industry: 'medical',
  productColumns: [
    { id: 'col_1', key: 'sno', label: '#', width: 6, visible: true, order: 0 },
    { id: 'col_2', key: 'name', label: 'Product Name', width: 28, visible: true, order: 1 },
    { id: 'col_3', key: 'batchNumber', label: 'Batch No.', width: 12, visible: true, order: 2 },
    { id: 'col_4', key: 'expiryDate', label: 'Expiry', width: 10, visible: true, order: 3 },
    { id: 'col_5', key: 'mrp', label: 'MRP', width: 10, visible: true, order: 4 },
    { id: 'col_6', key: 'gstPercent', label: 'GST%', width: 8, visible: true, order: 5 },
    { id: 'col_7', key: 'quantity', label: 'Qty', width: 8, visible: true, order: 6 },
    { id: 'col_8', key: 'unitPrice', label: 'Rate', width: 10, visible: true, order: 7 },
    { id: 'col_9', key: 'amount', label: 'Amount', width: 10, visible: true, order: 8 },
  ],
  productFields: [
    {
      id: 'fld_batch',
      key: 'batchNumber',
      label: 'Batch Number',
      type: 'text',
      required: true,
      placeholder: 'Batch no.',
      location: 'product',
      columnWidth: 12,
    },
    {
      id: 'fld_expiry',
      key: 'expiryDate',
      label: 'Expiry Date',
      type: 'date',
      required: true,
      placeholder: 'MM/YYYY',
      location: 'product',
      columnWidth: 10,
    },
    {
      id: 'fld_mrp',
      key: 'mrp',
      label: 'MRP',
      type: 'number',
      required: true,
      placeholder: 'MRP',
      location: 'product',
      columnWidth: 10,
    },
  ],
  customerFields: [
    {
      id: 'fld_doctor',
      key: 'doctorName',
      label: 'Doctor Name',
      type: 'text',
      required: false,
      placeholder: 'Prescribing doctor',
      location: 'customer',
    },
    {
      id: 'fld_prescription',
      key: 'prescriptionId',
      label: 'Prescription No.',
      type: 'text',
      required: false,
      placeholder: 'Prescription ID',
      location: 'customer',
    },
  ],
  documentFields: [],
  defaultGstMode: 'inclusive',
  features: {
    enableBatchNumber: true,
    enableExpiryDate: true,
  },
};

// Automobile Schema
export const AUTOMOBILE_SCHEMA: TemplateSchema = {
  industry: 'automobile',
  productColumns: [
    { id: 'col_1', key: 'sno', label: '#', width: 6, visible: true, order: 0 },
    { id: 'col_2', key: 'name', label: 'Part Name', width: 28, visible: true, order: 1 },
    { id: 'col_3', key: 'partNumber', label: 'Part No.', width: 12, visible: true, order: 2 },
    { id: 'col_4', key: 'vehicleModel', label: 'Vehicle', width: 14, visible: true, order: 3 },
    { id: 'col_5', key: 'gstPercent', label: 'GST%', width: 8, visible: true, order: 4 },
    { id: 'col_6', key: 'quantity', label: 'Qty', width: 8, visible: true, order: 5 },
    { id: 'col_7', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 6 },
    { id: 'col_8', key: 'amount', label: 'Amount', width: 12, visible: true, order: 7 },
  ],
  productFields: [
    {
      id: 'fld_partnum',
      key: 'partNumber',
      label: 'Part Number',
      type: 'text',
      required: false,
      placeholder: 'OEM part number',
      location: 'product',
      columnWidth: 12,
    },
    {
      id: 'fld_vehicle',
      key: 'vehicleModel',
      label: 'Vehicle Model',
      type: 'text',
      required: false,
      placeholder: 'e.g., Maruti Swift',
      location: 'product',
      columnWidth: 14,
    },
    {
      id: 'fld_engine',
      key: 'engineNumber',
      label: 'Engine Number',
      type: 'text',
      required: false,
      placeholder: 'Engine/chassis no.',
      location: 'product',
    },
    {
      id: 'fld_warranty_months',
      key: 'warrantyMonths',
      label: 'Warranty (months)',
      type: 'number',
      required: false,
      placeholder: 'Warranty period',
      location: 'product',
    },
  ],
  customerFields: [
    {
      id: 'fld_vehicle_reg',
      key: 'vehicleRegistration',
      label: 'Vehicle Reg. No.',
      type: 'text',
      required: false,
      placeholder: 'e.g., MH01AB1234',
      location: 'customer',
    },
  ],
  documentFields: [],
  defaultGstMode: 'inclusive',
  features: {
    enableWarranty: true,
  },
};

// Retail Schema
export const RETAIL_SCHEMA: TemplateSchema = {
  industry: 'retail',
  productColumns: [
    { id: 'col_1', key: 'sno', label: '#', width: 6, visible: true, order: 0 },
    { id: 'col_2', key: 'name', label: 'Item', width: 35, visible: true, order: 1 },
    { id: 'col_3', key: 'hsnCode', label: 'HSN', width: 10, visible: true, order: 2 },
    { id: 'col_4', key: 'gstPercent', label: 'GST%', width: 8, visible: true, order: 3 },
    { id: 'col_5', key: 'quantity', label: 'Qty', width: 10, visible: true, order: 4 },
    { id: 'col_6', key: 'unitPrice', label: 'Rate', width: 12, visible: true, order: 5 },
    { id: 'col_7', key: 'discount', label: 'Disc%', width: 8, visible: true, order: 6 },
    { id: 'col_8', key: 'amount', label: 'Amount', width: 12, visible: true, order: 7 },
  ],
  productFields: [
    {
      id: 'fld_discount',
      key: 'discount',
      label: 'Discount %',
      type: 'number',
      required: false,
      defaultValue: 0,
      placeholder: 'Discount',
      location: 'product',
      columnWidth: 8,
      validation: { min: 0, max: 100 },
    },
  ],
  customerFields: [],
  documentFields: [],
  defaultGstMode: 'inclusive',
  features: {
    enableDiscount: true,
  },
};

// Services Schema
export const SERVICES_SCHEMA: TemplateSchema = {
  industry: 'services',
  productColumns: [
    { id: 'col_1', key: 'sno', label: '#', width: 6, visible: true, order: 0 },
    { id: 'col_2', key: 'name', label: 'Service Description', width: 40, visible: true, order: 1 },
    { id: 'col_3', key: 'hsnSacCode', label: 'HSN/SAC', width: 10, visible: true, order: 2 },
    { id: 'col_4', key: 'gstPercent', label: 'GST%', width: 8, visible: true, order: 3 },
    { id: 'col_5', key: 'quantity', label: 'Qty', width: 8, visible: true, order: 4 },
    { id: 'col_6', key: 'unitPrice', label: 'Rate', width: 14, visible: true, order: 5 },
    { id: 'col_7', key: 'amount', label: 'Amount', width: 14, visible: true, order: 6 },
  ],
  productFields: [],
  customerFields: [],
  documentFields: [],
  defaultGstMode: 'exclusive',
  features: {},
};

// General Default Schema
export const GENERAL_SCHEMA: TemplateSchema = {
  industry: 'general',
  productColumns: getDefaultProductColumns(),
  productFields: [],
  customerFields: [],
  documentFields: [],
  defaultGstMode: 'inclusive',
  features: {},
};

const getDefaultTemplates = (): QuotationTemplate[] => {
  const now = new Date().toISOString();
  const stdCols = getDefaultProductColumns();

  return [
    // Template 1: Luxury Gold Invoice
    {
      id: 'tpl_luxury_gold',
      name: 'Luxury Gold Invoice',
      description: 'Premium invoice with elegant gold borders, decorative corners, and sophisticated styling.',
      category: 'luxury',
      themeId: 'luxury',
      isDefault: true,
      isPremium: true,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      schema: GENERAL_SCHEMA,
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
      description: 'Modern blue header with professional styling.',
      category: 'modern',
      themeId: 'stylish',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      schema: GENERAL_SCHEMA,
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
      description: 'Full borders with accounting-style layout.',
      category: 'gst',
      themeId: 'tally',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: stdCols,
      schema: GENERAL_SCHEMA,
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
      description: 'Dmart/Big Bazaar inspired layout.',
      category: 'retail',
      themeId: 'billbook',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: RETAIL_SCHEMA.productColumns,
      schema: RETAIL_SCHEMA,
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
    // Template 5: Solar Energy Invoice
    {
      id: 'tpl_solar',
      name: 'Solar Energy Invoice',
      description: 'Specialized template for solar panel and inverter businesses with wattage and installation fields.',
      category: 'specialty',
      themeId: 'modern',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: SOLAR_SCHEMA.productColumns,
      schema: SOLAR_SCHEMA,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showTermsConditions: true,
      },
    },
    // Template 6: Medical/Pharmacy Invoice
    {
      id: 'tpl_medical',
      name: 'Medical/Pharmacy Invoice',
      description: 'Pharmacy invoice with batch number, expiry date, and doctor information.',
      category: 'specialty',
      themeId: 'simple',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: MEDICAL_SCHEMA.productColumns,
      schema: MEDICAL_SCHEMA,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showTermsConditions: true,
        showBatchNumber: true,
        showExpiryDate: true,
      },
    },
    // Template 7: Automobile Spare Parts
    {
      id: 'tpl_automobile',
      name: 'Automobile Spare Parts',
      description: 'Auto parts invoice with part numbers, vehicle model, and warranty.',
      category: 'specialty',
      themeId: 'stylish',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: AUTOMOBILE_SCHEMA.productColumns,
      schema: AUTOMOBILE_SCHEMA,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showTermsConditions: true,
        showVehicleNumber: true,
      },
    },
    // Template 8: Services Invoice
    {
      id: 'tpl_services',
      name: 'Services Invoice',
      description: 'Professional services invoice with SAC codes.',
      category: 'professional',
      themeId: 'modern',
      isDefault: false,
      isPremium: false,
      createdAt: now,
      updatedAt: now,
      productColumns: SERVICES_SCHEMA.productColumns,
      schema: SERVICES_SCHEMA,
      settings: {
        ...DEFAULT_TEMPLATE_SETTINGS,
        showBankDetails: true,
        showSignature: true,
        showTermsConditions: true,
      },
    },
  ];
};

// Round to 2 decimal places - fixes floating point precision issues
export const roundTo2 = (value: number): number => {
  return Math.round(value * 100) / 100;
};

// Calculate base amount (quantity * unitPrice) or return manual override
export const calculateProductAmount = (product: Product): number => {
  // If manual override is set, use that value
  if (product.isManualAmount && product.manualAmount !== undefined) {
    return roundTo2(product.manualAmount);
  }
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
    const key = `${product.hsnSacCode}_${product.gstPercent}`;
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

// ─── Expiry and Stock Helper Functions ─────────────────────────────────────

// Calculate expiry status based on expiry date
export const getExpiryStatus = (expiryDate?: string): ExpiryStatus => {
  if (!expiryDate) return 'safe';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring_soon';
  return 'safe';
};

// Get expiry status label
export const getExpiryStatusLabel = (status: ExpiryStatus): string => {
  switch (status) {
    case 'expired': return 'Expired';
    case 'expiring_soon': return 'Expiring Soon';
    default: return 'Safe';
  }
};

// Check if product is low stock
export const isLowStock = (product: ProductCatalogItem): boolean => {
  if (product.minStockAlert === undefined || product.minStockAlert === null) return false;
  return product.stockQuantity <= product.minStockAlert;
};

// Get days until expiry
export const getDaysUntilExpiry = (expiryDate?: string): number | null => {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Generate unique SKU
export const generateSku = (name: string): string => {
  const prefix = name.substring(0, 3).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

// Get default unit based on industry type
export const getDefaultUnit = (industryType?: IndustryType): UnitType => {
  switch (industryType) {
    case 'medical': return 'strip';
    case 'solar': return 'piece';
    case 'automobile': return 'piece';
    case 'hardware': return 'piece';
    case 'cement': return 'bag';
    case 'services': return 'hour';
    default: return 'piece';
  }
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
