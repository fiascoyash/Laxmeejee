import { useState, useEffect } from 'react';
import { CompanyProfile, Customer, Product, ProductCatalogItem, Quotation, QuotationTemplate, Invoice, NumberingSettings, TableColumn, GstMode, ShipTo } from './types';
import { storage, generateId, generateQuotationNumber, generateInvoiceNumber, convertQuotationToInvoice, calculateTaxSummary, getDefaultProductColumns, incrementQuotationNumber, incrementInvoiceNumber, calculateRoundOff, roundTo2, calculateGrandTotalAmount } from './utils/storage';
import { CompanyProfile as CompanyProfileModal } from './components/CompanyProfile';
import { CustomerDetails } from './components/CustomerDetails';
import { ProductTable } from './components/ProductTable';
import { QuotationList } from './components/QuotationList';
import { ProductCatalog } from './components/ProductCatalog';
import { TemplateBuilder } from './components/TemplateBuilder';
import { TemplateLibrary } from './components/TemplateLibrary';
import { TemplatePreview } from './components/TemplatePreview';
import { TemplateSelection } from './components/TemplateSelection';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoiceList } from './components/InvoiceList';
import { NumberingSettingsPanel } from './components/NumberingSettings';
import { exportTemplatePDF } from './utils/templatePdfExport';
import { Sun, FileText, Package, Settings, FileDown, Save, List, Building2, Menu, X, Home, ChevronRight, LayoutGrid as Layout, Eye, Receipt, Trash2, PenTool, type LucideIcon, Keyboard } from 'lucide-react';

type View = 'home' | 'selectTemplate' | 'new' | 'list' | 'catalog' | 'settings' | 'templates' | 'newInvoice' | 'invoiceList' | 'editInvoice';

function App() {
  const [view, setView] = useState<View>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Company Profile State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(storage.getCompanyProfile);
  const [showCompanyProfile, setShowCompanyProfile] = useState(false);

  // Product Catalog State
  const [catalog, setCatalog] = useState<ProductCatalogItem[]>(storage.getProductCatalog);

  // Quotation Form State
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [customer, setCustomer] = useState<Customer>({
    name: '',
    billingAddress: '',
    mobile: '',
    district: '',
    village: '',
    gstNumber: '',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [productColumns, setProductColumns] = useState<TableColumn[]>(getDefaultProductColumns());
  const [gstMode, setGstMode] = useState<GstMode>('inclusive');
  const [shipTo, setShipTo] = useState<ShipTo>({ name: '', address: '', mobile: '', gstNumber: '' });

  // Quotation dynamic fields state (controlled by template settings)
  const [quotation, setQuotation] = useState<{
    notes?: string;
    signature?: string;
    paymentQr?: string;
    terms?: string;
  }>({});

  // Selected Template State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Quotation List State
  const [quotations, setQuotations] = useState<Quotation[]>(storage.getQuotations);

  // Invoice State
  const [invoices, setInvoices] = useState<Invoice[]>(storage.getInvoices);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Numbering Settings State
  const [numberingSettings, setNumberingSettings] = useState<NumberingSettings>(storage.getNumberingSettings);

  // Template State
  const [templates, setTemplates] = useState<QuotationTemplate[]>(storage.getTemplates);
  const [editingTemplate, setEditingTemplate] = useState<QuotationTemplate | null>(null);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<QuotationTemplate | null>(null);
  const [previewType, setPreviewType] = useState<'quotation' | 'invoice'>('quotation');

  // Keyboard shortcuts modal state
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Load data on mount
  useEffect(() => {
    setQuotations(storage.getQuotations);
    setCatalog(storage.getProductCatalog);
    setTemplates(storage.getTemplates);
    setInvoices(storage.getInvoices);
    // Set default template as selected
    const defaultTemplate = storage.getDefaultTemplate();
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, []);

  // Global keyboard shortcuts handler
  useEffect(() => {
    const handleKeyboardShortcuts = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const isAlt = event.altKey;

      // Ctrl+N → New Quotation
      if (isCtrlOrCmd && event.key === 'n') {
        event.preventDefault();
        startNewQuotation();
        return;
      }

      // Ctrl+I → New Invoice
      if (isCtrlOrCmd && event.key === 'i') {
        event.preventDefault();
        startNewInvoice();
        return;
      }

      // Ctrl+S → Save
      if (isCtrlOrCmd && event.key === 's') {
        event.preventDefault();
        if (view === 'new') {
          saveQuotation();
        } else if (view === 'editInvoice') {
          saveInvoice();
        }
        return;
      }

      // Ctrl+P → Preview
      if (isCtrlOrCmd && event.key === 'p') {
        event.preventDefault();
        if (view === 'new' && selectedTemplateId) {
          const template = storage.getTemplateById(selectedTemplateId);
          if (template) setPreviewingTemplate(template);
        } else if (view === 'editInvoice') {
          previewInvoice();
        }
        return;
      }

      // Ctrl+E → Export PDF
      if (isCtrlOrCmd && event.key === 'e') {
        event.preventDefault();
        if (view === 'new' && selectedTemplateId) {
          const template = storage.getTemplateById(selectedTemplateId);
          if (template && customer.name && products.length > 0) {
            const taxSummary = calculateTaxSummary(products, gstMode);
            const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
            const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
            const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
            const grandTotalAmount = calculateGrandTotalAmount(products, gstMode);
            const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);
            const quotationData: Quotation = {
              id: editingQuotationId || 'temp',
              quotationNumber,
              date: quotationDate,
              customer,
              shipTo,
              products,
              totalAmount,
              totalCgst,
              totalSgst,
              roundOff,
              grandTotal: roundedGrandTotal,
              createdAt: new Date().toISOString(),
              selectedTemplateId,
              productColumns,
              gstMode,
              notes: quotation.notes,
              signature: quotation.signature,
              paymentQr: quotation.paymentQr,
              terms: quotation.terms,
            };
            exportTemplatePDF(template, companyProfile, customer, quotationData, products, 'quotation');
          }
        } else if (view === 'editInvoice') {
          exportInvoicePDF();
        }
        return;
      }

      // Ctrl+H → Quotation History
      if (isCtrlOrCmd && event.key === 'h') {
        event.preventDefault();
        navigateTo('list');
        return;
      }

      // Ctrl+J → Invoice History
      if (isCtrlOrCmd && event.key === 'j') {
        event.preventDefault();
        navigateTo('invoiceList');
        return;
      }

      // Ctrl+T → Templates
      if (isCtrlOrCmd && event.key === 't') {
        event.preventDefault();
        navigateTo('templates');
        return;
      }

      // Ctrl+D → Dashboard
      if (isCtrlOrCmd && event.key === 'd') {
        event.preventDefault();
        navigateTo('home');
        return;
      }

      // Alt+A → Add product row
      if (isAlt && event.key === 'a') {
        event.preventDefault();
        if (view === 'new' || view === 'editInvoice') {
          const newProduct: Product = {
            id: generateId(),
            name: '',
            hsnCode: '',
            gstPercent: 18,
            quantity: 1,
            unitPrice: 0,
          };
          if (view === 'new') {
            setProducts([...products, newProduct]);
          } else if (editingInvoice) {
            setEditingInvoice({
              ...editingInvoice,
              products: [...editingInvoice.products, newProduct],
            });
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [view, selectedTemplateId, customer, products, gstMode, editingInvoice, editingQuotationId, quotationNumber, quotationDate, shipTo, productColumns, quotation]);

  // ESC key handler to close active modals/screens (layer by layer)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close keyboard shortcuts modal first
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        // Close highest active layer first (preview modal)
        if (previewingTemplate) {
          setPreviewingTemplate(null);
          setPreviewType('quotation');
          return;
        }
        // Close template builder
        if (showTemplateBuilder) {
          setShowTemplateBuilder(false);
          setEditingTemplate(null);
          return;
        }
        // Close company profile modal
        if (showCompanyProfile) {
          setShowCompanyProfile(false);
          return;
        }
        // Close edit invoice screen
        if (editingInvoice) {
          setEditingInvoice(null);
          setView('invoiceList');
          return;
        }
        // Close edit quotation screen (if on 'new' view with editingQuotationId)
        if (view === 'new' && editingQuotationId) {
          resetForm();
          setView('home');
          return;
        }
        // Close new quotation screen (if on 'new' view without editing)
        if (view === 'new') {
          resetForm();
          setView('home');
          return;
        }
        // Navigate to Dashboard from any other page
        if (view !== 'home') {
          setView('home');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showShortcutsModal, previewingTemplate, showTemplateBuilder, showCompanyProfile, editingInvoice, view, editingQuotationId]);

  // Navigate to a view, clearing any edit states
  const navigateTo = (targetView: View) => {
    // Clear all edit states when navigating
    setEditingInvoice(null);
    // If leaving quotation form, reset it
    if (view === 'new' || view === 'selectTemplate') {
      resetForm();
    }
    setView(targetView);
    setSidebarOpen(false);
  };

  // Save company profile
  const handleSaveCompanyProfile = (profile: CompanyProfile) => {
    storage.saveCompanyProfile(profile);
    setCompanyProfile(profile);
  };

  // Save catalog
  const handleSaveCatalog = (catalogItems: ProductCatalogItem[]) => {
    storage.saveProductCatalog(catalogItems);
    setCatalog(catalogItems);
  };

  // Reset quotation form
  const resetForm = () => {
    setEditingQuotationId(null);
    setQuotationNumber(generateQuotationNumber());
    setQuotationDate(new Date().toISOString().split('T')[0]);
    setCustomer({ name: '', billingAddress: '', mobile: '', district: '', village: '', gstNumber: '' });
    setProducts([]);
    setProductColumns(getDefaultProductColumns());
    setGstMode('inclusive');
    setShipTo({ name: '', address: '', mobile: '', gstNumber: '' });
    setQuotation({ notes: '', signature: '', paymentQr: '', terms: '' });
  };

  // Start new quotation - go to template selection first
  const startNewQuotation = () => {
    resetForm();
    setView('selectTemplate');
  };

  // Edit existing quotation
  const editQuotation = (quotation: Quotation) => {
    setEditingQuotationId(quotation.id);
    setQuotationNumber(quotation.quotationNumber);
    setQuotationDate(quotation.date);
    setCustomer(quotation.customer);
    setProducts(quotation.products);
    setGstMode(quotation.gstMode || 'inclusive');
    setShipTo(quotation.shipTo || { name: '', address: '', mobile: '', gstNumber: '' });
    // Restore dynamic fields
    setQuotation({
      notes: quotation.notes || '',
      signature: quotation.signature || '',
      paymentQr: quotation.paymentQr || '',
      terms: quotation.terms || '',
    });
    // Restore the template used for this quotation
    if (quotation.selectedTemplateId) {
      setSelectedTemplateId(quotation.selectedTemplateId);
      // Load template schema columns
      const template = storage.getTemplateById(quotation.selectedTemplateId);
      if (template?.schema?.productColumns) {
        setProductColumns(template.schema.productColumns);
      } else if (quotation.productColumns) {
        setProductColumns(quotation.productColumns);
      } else {
        setProductColumns(getDefaultProductColumns());
      }
    } else {
      setProductColumns(quotation.productColumns || getDefaultProductColumns());
    }
    setView('new');
  };

  // Save quotation
  const saveQuotation = () => {
    if (!customer.name) {
      alert('Please enter customer name');
      return;
    }
    if (products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    const taxSummary = calculateTaxSummary(products, gstMode);
    const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
    const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
    const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
    const grandTotalAmount = calculateGrandTotalAmount(products, gstMode);
    const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

    const newQuotation: Quotation = {
      id: editingQuotationId || generateId(),
      quotationNumber: editingQuotationId ? quotationNumber : generateQuotationNumber(),
      date: quotationDate,
      customer,
      shipTo,
      products,
      totalAmount,
      totalCgst,
      totalSgst,
      roundOff,
      grandTotal: roundedGrandTotal,
      createdAt: editingQuotationId ? quotations.find(q => q.id === editingQuotationId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      selectedTemplateId: selectedTemplateId || undefined,
      productColumns,
      gstMode,
      // Dynamic fields from template settings
      notes: quotation.notes,
      signature: quotation.signature,
      paymentQr: quotation.paymentQr,
      terms: quotation.terms,
    };

    storage.saveQuotation(newQuotation);
    if (!editingQuotationId) incrementQuotationNumber();
    setQuotations(storage.getQuotations());
    alert(editingQuotationId ? 'Quotation updated successfully!' : 'Quotation saved successfully!');
    resetForm();
    setView('list');
  };

  // Delete quotation
  const deleteQuotation = (id: string) => {
    if (confirm('Are you sure you want to delete this quotation?')) {
      storage.deleteQuotation(id);
      setQuotations(storage.getQuotations());
    }
  };

  // Duplicate quotation
  const duplicateQuotation = (id: string) => {
    const newQuotation = storage.duplicateQuotation(id);
    if (newQuotation) {
      setQuotations(storage.getQuotations());
      alert(`Quotation duplicated as ${newQuotation.quotationNumber}`);
    }
  };

  // Convert quotation to invoice
  const convertToInvoice = (quotation: Quotation) => {
    const invoice = convertQuotationToInvoice(quotation);
    storage.saveInvoice(invoice);
    setInvoices(storage.getInvoices());
    alert(`Invoice ${invoice.invoiceNumber} created from ${quotation.quotationNumber}`);
    setEditingInvoice(invoice);
    setView('editInvoice');
  };

  // Save invoice
  const saveInvoice = () => {
    if (!editingInvoice) return;
    if (!editingInvoice.customer.name) {
      alert('Please enter customer name');
      return;
    }
    if (editingInvoice.products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    const invoiceGstMode = editingInvoice.gstMode || 'inclusive';
    const taxSummary = calculateTaxSummary(editingInvoice.products, invoiceGstMode);
    const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
    const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
    const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
    const grandTotalAmount = calculateGrandTotalAmount(editingInvoice.products, invoiceGstMode);
    const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

    const toSave: Invoice = {
      ...editingInvoice,
      totalAmount,
      totalCgst,
      totalSgst,
      roundOff,
      grandTotal: roundedGrandTotal,
      updatedAt: new Date().toISOString(),
    };

    storage.saveInvoice(toSave);
    if (!invoices.find(i => i.id === toSave.id)) incrementInvoiceNumber();
    setInvoices(storage.getInvoices());
    alert('Invoice saved successfully!');
    setEditingInvoice(null);
    setView('invoiceList');
  };

  // Delete invoice
  const deleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      storage.deleteInvoice(id);
      setInvoices(storage.getInvoices());
    }
  };

  // Duplicate invoice
  const duplicateInvoice = (id: string) => {
    const newInvoice = storage.duplicateInvoice(id);
    if (newInvoice) {
      setInvoices(storage.getInvoices());
      alert(`Invoice duplicated as ${newInvoice.invoiceNumber}`);
    }
  };

  // Edit invoice
  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setView('editInvoice');
  };

  // Export invoice PDF
  const exportInvoicePDF = () => {
    if (!editingInvoice) return;
    if (editingInvoice.products.length === 0) {
      alert('Please add products before exporting');
      return;
    }

    const template = editingInvoice.selectedTemplateId
      ? storage.getTemplateById(editingInvoice.selectedTemplateId)
      : storage.getDefaultTemplate();
    if (!template) {
      alert('No template available');
      return;
    }

    const templateWithColumns = editingInvoice.productColumns
      ? { ...template, productColumns: editingInvoice.productColumns }
      : template;

    const quotationProxy = {
      id: editingInvoice.id,
      quotationNumber: editingInvoice.invoiceNumber,
      date: editingInvoice.date,
      customer: editingInvoice.customer,
      shipTo: editingInvoice.shipTo,
      products: editingInvoice.products,
      totalAmount: editingInvoice.totalAmount,
      totalCgst: editingInvoice.totalCgst,
      totalSgst: editingInvoice.totalSgst,
      grandTotal: editingInvoice.grandTotal,
      createdAt: editingInvoice.createdAt,
      selectedTemplateId: editingInvoice.selectedTemplateId,
      gstMode: editingInvoice.gstMode,
      notes: editingInvoice.notes,
      signature: editingInvoice.signature,
      paymentQr: editingInvoice.paymentQr,
      terms: editingInvoice.terms,
    } as Quotation;

    exportTemplatePDF(templateWithColumns, companyProfile, editingInvoice.customer, quotationProxy, editingInvoice.products, 'invoice', editingInvoice, editingInvoice.gstMode || 'inclusive');
  };

  // Preview invoice
  const previewInvoice = () => {
    if (!editingInvoice) return;
    const template = editingInvoice.selectedTemplateId
      ? storage.getTemplateById(editingInvoice.selectedTemplateId)
      : storage.getDefaultTemplate();
    if (template) {
      const templateWithColumns = editingInvoice.productColumns
        ? { ...template, productColumns: editingInvoice.productColumns }
        : template;
      setPreviewType('invoice');
      setPreviewingTemplate(templateWithColumns);
    }
  };

  // Start new invoice - uses selected template schema
  const startNewInvoice = () => {
    const template = selectedTemplateId ? storage.getTemplateById(selectedTemplateId) : storage.getDefaultTemplate();
    const schemaColumns = template?.schema?.productColumns || getDefaultProductColumns();

    const newInvoice: Invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customer: { name: '', billingAddress: '', mobile: '', district: '', village: '', gstNumber: '' },
      shipTo: { name: '', address: '', mobile: '', gstNumber: '' },
      products: [],
      totalAmount: 0,
      totalCgst: 0,
      totalSgst: 0,
      roundOff: 0,
      grandTotal: 0,
      status: 'Draft',
      selectedTemplateId: selectedTemplateId || template?.id,
      productColumns: schemaColumns,
      gstMode: template?.schema?.defaultGstMode || 'inclusive',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingInvoice(newInvoice);
    setView('editInvoice');
  };

  // Get sample data for template preview (only used for TemplateBuilder preview, not form preview)
  const getSampleData = () => ({
    customer: {
      name: 'Sample Customer',
      billingAddress: '123 Main Street',
      mobile: '9876543210',
      district: 'Sample District',
      village: 'Sample Village',
      gstNumber: '',
    },
    quotation: {
      id: 'sample',
      quotationNumber: 'QT-2024-0001',
      date: new Date().toISOString().split('T')[0],
      customer: {
        name: 'Sample Customer',
        billingAddress: '123 Main Street',
        mobile: '9876543210',
        district: 'Sample District',
        village: 'Sample Village',
        gstNumber: '',
      },
      shipTo: {
        name: 'Sample Ship To',
        address: '456 Delivery Road',
        mobile: '9876543210',
        gstNumber: '',
      },
      products: [
        { id: '1', name: 'Solar Panel 335W', hsnCode: '8541', gstPercent: 18, quantity: 10, unitPrice: 12000 },
        { id: '2', name: 'Solar Inverter 3kW', hsnCode: '8504', gstPercent: 18, quantity: 1, unitPrice: 35000 },
      ],
      totalAmount: 155000,
      totalCgst: 11100,
      totalSgst: 11100,
      roundOff: 0,
      grandTotal: 177200,
      createdAt: new Date().toISOString(),
      selectedTemplateId: selectedTemplateId || undefined,
      notes: '',
      signature: '',
      paymentQr: '',
      terms: '',
    } as Quotation,
    products: [
      { id: '1', name: 'Solar Panel 335W', hsnCode: '8541', gstPercent: 18, quantity: 10, unitPrice: 12000 },
      { id: '2', name: 'Solar Inverter 3kW', hsnCode: '8504', gstPercent: 18, quantity: 1, unitPrice: 35000 },
    ],
  });

  // Build quotation object from current form state (for Preview and PDF export)
  const buildCurrentQuotation = (): Quotation => {
    const taxSummary = calculateTaxSummary(products, gstMode);
    const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
    const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
    const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
    const grandTotalAmount = calculateGrandTotalAmount(products, gstMode);
    const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

    return {
      id: editingQuotationId || 'preview',
      quotationNumber: quotationNumber || 'QT-PREVIEW',
      date: quotationDate,
      customer,
      shipTo,
      products,
      totalAmount,
      totalCgst,
      totalSgst,
      roundOff,
      grandTotal: roundedGrandTotal,
      createdAt: editingQuotationId ? quotations.find(q => q.id === editingQuotationId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      selectedTemplateId: selectedTemplateId || undefined,
      productColumns,
      gstMode,
      notes: quotation.notes,
      signature: quotation.signature,
      paymentQr: quotation.paymentQr,
      terms: quotation.terms,
    };
  };

  // Get current template
  const getCurrentTemplate = (): QuotationTemplate | undefined => {
    if (selectedTemplateId) {
      return storage.getTemplateById(selectedTemplateId);
    }
    return storage.getDefaultTemplate();
  };

  // Export PDF - always uses selected template
  const exportPDF = () => {
    if (products.length === 0) {
      alert('Please add products before exporting');
      return;
    }

    const template = getCurrentTemplate();
    if (!template) {
      alert('No template selected. Please select a template first.');
      return;
    }

    const taxSummary = calculateTaxSummary(products, gstMode);
    const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
    const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
    const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
    const grandTotalAmount = calculateGrandTotalAmount(products, gstMode);
    const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

    const quotationForPdf: Quotation = {
      id: editingQuotationId || 'temp',
      quotationNumber: quotationNumber || 'QT-PREVIEW',
      date: quotationDate,
      customer,
      shipTo,
      products,
      totalAmount,
      totalCgst,
      totalSgst,
      roundOff,
      grandTotal: roundedGrandTotal,
      createdAt: new Date().toISOString(),
      selectedTemplateId: selectedTemplateId || undefined,
      productColumns,
      gstMode,
      // Dynamic fields from form state
      notes: quotation.notes,
      signature: quotation.signature,
      paymentQr: quotation.paymentQr,
      terms: quotation.terms,
    };

    const templateWithColumns = { ...template, productColumns };
    exportTemplatePDF(templateWithColumns, companyProfile, customer, quotationForPdf, products, 'quotation', undefined, gstMode);
  };

  // Template handlers
  const handleSaveTemplate = (template: QuotationTemplate) => {
    storage.saveTemplate(template);
    setTemplates(storage.getTemplates());
    setShowTemplateBuilder(false);
    setEditingTemplate(null);
    alert('Template saved successfully!');
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      storage.deleteTemplate(id);
      setTemplates(storage.getTemplates());
      // If deleted template was selected, reset selection
      if (selectedTemplateId === id) {
        const defaultTemplate = storage.getDefaultTemplate();
        setSelectedTemplateId(defaultTemplate?.id || null);
      }
    }
  };

  const handleDuplicateTemplate = (id: string) => {
    const newTemplate = storage.duplicateTemplate(id);
    if (newTemplate) {
      setTemplates(storage.getTemplates());
      alert('Template duplicated successfully!');
    }
  };

  const handleSetDefaultTemplate = (id: string) => {
    const updatedTemplates = templates.map(t => ({
      ...t,
      isDefault: t.id === id,
    }));
    storage.saveTemplates(updatedTemplates);
    setTemplates(updatedTemplates);
  };

  const handleEditTemplate = (template: QuotationTemplate) => {
    setEditingTemplate(template);
    setShowTemplateBuilder(true);
  };

  const handlePreviewTemplate = (template: QuotationTemplate) => {
    setPreviewingTemplate(template);
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplate(null);
    setShowTemplateBuilder(true);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    // Apply template schema to form
    const template = storage.getTemplateById(templateId);
    if (template?.schema?.productColumns) {
      setProductColumns(template.schema.productColumns);
    }
    if (template?.schema?.defaultGstMode) {
      setGstMode(template.schema.defaultGstMode);
    }
  };

  const handleTemplateContinue = () => {
    if (!selectedTemplateId) {
      alert('Please select a template to continue');
      return;
    }
    setView('new');
  };

  // Preview current quotation with selected template
  const handlePreviewCurrentQuotation = () => {
    const template = getCurrentTemplate();
    if (template) {
      setPreviewType('quotation');
      setPreviewingTemplate(template);
    }
  };

  const NavItem = ({ icon: Icon, label, currentView, targetView }: {
    icon: LucideIcon;
    label: string;
    currentView: View;
    targetView: View;
  }) => (
    <button
      onClick={() => navigateTo(targetView)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        currentView === targetView
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );

  const selectedTemplate = getCurrentTemplate();
  const invoiceTemplate = editingInvoice?.selectedTemplateId
    ? storage.getTemplateById(editingInvoice.selectedTemplateId)
    : storage.getDefaultTemplate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Sun className="w-6 h-6 text-emerald-500" />
            <span className="font-bold text-slate-800">Laxmeejee</span>
          </div>
          <button
            onClick={() => setShowCompanyProfile(true)}
            className="p-2 rounded-lg hover:bg-slate-100"
          >
            <Settings className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white flex flex-col shadow-xl z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white tracking-tight">Laxmeejee</h1>
          <p className="text-slate-400 text-sm mt-1">GST Invoice System</p>
        </div>

        <nav className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-1 px-3">
            <li><NavItem icon={Home} label="Dashboard" currentView={view} targetView="home" /></li>
            <li><NavItem icon={FileText} label="New Quotation" currentView={view} targetView="selectTemplate" /></li>
            <li><NavItem icon={List} label="Quotation History" currentView={view} targetView="list" /></li>
          </ul>
          <div className="mt-4 px-3">
            <p className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoices</p>
            <ul className="space-y-1">
              <li><NavItem icon={Receipt} label="New Invoice" currentView={view} targetView="newInvoice" /></li>
              <li><NavItem icon={Receipt} label="Invoice History" currentView={view} targetView="invoiceList" /></li>
            </ul>
          </div>
          <ul className="mt-4 space-y-1 px-3">
            <li><NavItem icon={Layout} label="Templates" currentView={view} targetView="templates" /></li>
            <li><NavItem icon={Package} label="Product Catalog" currentView={view} targetView="catalog" /></li>
            <li><NavItem icon={Settings} label="Settings" currentView={view} targetView="settings" /></li>
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs"
          >
            <Keyboard className="w-4 h-4" />
            <span>Keyboard Shortcuts</span>
          </button>
          <p className="text-slate-500 text-xs mt-2 px-3">Press ESC to go to Dashboard</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Desktop Header */}
        <header className="hidden lg:block bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <button
                onClick={() => navigateTo('home')}
                className="hover:text-emerald-600 transition-colors"
              >
                Dashboard
              </button>
              {view !== 'home' && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-slate-800 font-medium capitalize">
                    {view === 'selectTemplate' ? 'Select Template' : view === 'newInvoice' ? 'New Invoice' : view === 'invoiceList' ? 'Invoice History' : view === 'editInvoice' ? 'Edit Invoice' : view}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCompanyProfile(true)}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
              >
                <Building2 className="w-4 h-4" />
                Company Profile
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {/* Home Dashboard */}
          {view === 'home' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-2">Dashboard</h2>
                <p className="text-slate-500">Welcome to Laxmeejee GST Invoice System</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={startNewQuotation}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-blue-400 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                    <FileText className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">New Quotation</h3>
                  <p className="text-sm text-slate-500">Create a new quotation</p>
                </button>

                <button
                  onClick={() => navigateTo('list')}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-emerald-400 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
                    <List className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">Quotation History</h3>
                  <p className="text-sm text-slate-500">{quotations.length} quotations saved</p>
                </button>

                <button
                  onClick={() => navigateTo('invoiceList')}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-amber-400 transition-all group"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors">
                    <Receipt className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">Invoice History</h3>
                  <p className="text-sm text-slate-500">{invoices.length} invoices</p>
                </button>

                <button
                  onClick={() => navigateTo('templates')}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-purple-400 transition-all group"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                    <Layout className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">Templates</h3>
                  <p className="text-sm text-slate-500">{templates.length} templates</p>
                </button>
              </div>

              {/* Recent Quotations */}
              {quotations.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Quotations</h3>
                  <div className="space-y-3">
                    {quotations.slice(0, 3).map(q => (
                      <div
                        key={q.id}
                        className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => editQuotation(q)}
                      >
                        <div>
                          <span className="font-medium text-emerald-600">{q.quotationNumber}</span>
                          <span className="text-slate-400 mx-2">|</span>
                          <span className="text-slate-600">{q.customer.name}</span>
                        </div>
                        <span className="font-medium text-slate-800">Rs. {q.grandTotal.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Setup */}
              {!companyProfile.companyName && (
                <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-800 mb-2">Get Started</h3>
                  <p className="text-emerald-600 mb-4">Complete your company profile to create professional quotations.</p>
                  <button
                    onClick={() => setShowCompanyProfile(true)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Setup Company Profile
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Template Selection */}
          {view === 'selectTemplate' && (
            <TemplateSelection
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelect={handleSelectTemplate}
              onContinue={handleTemplateContinue}
              onManageTemplates={() => navigateTo('templates')}
              companyProfile={companyProfile}
            />
          )}

          {/* New Quotation Form */}
          {view === 'new' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {editingQuotationId ? 'Edit Quotation' : 'New Quotation'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={quotationNumber}
                      onChange={(e) => setQuotationNumber(e.target.value)}
                      placeholder="Auto-generated on save"
                      className="px-2 py-1 text-sm text-gray-600 border border-gray-200 rounded font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                    />
                    <span className="text-xs text-gray-400">editable</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                  {/* Template indicator */}
                  {selectedTemplate && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm">
                      <Layout className="w-4 h-4 text-purple-600" />
                      <span className="text-purple-700 font-medium">{selectedTemplate.name}</span>
                      <button
                        onClick={() => setView('selectTemplate')}
                        className="text-purple-600 hover:text-purple-800 text-xs underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <CustomerDetails
                customer={customer}
                onChange={setCustomer}
                shipTo={shipTo}
                onShipToChange={setShipTo}
                customFields={selectedTemplate?.schema?.customerFields || []}
              />
              <ProductTable
                products={products}
                onChange={setProducts}
                catalog={catalog}
                columns={productColumns}
                onColumnsChange={setProductColumns}
                gstMode={gstMode}
                onGstModeChange={setGstMode}
                customFields={selectedTemplate?.schema?.productFields || []}
                templateSettings={selectedTemplate?.settings}
                schema={selectedTemplate?.schema}
              />

              {/* Dynamic Fields based on Template Settings */}
              {selectedTemplate?.settings && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Notes */}
                    {selectedTemplate.settings.showNotes && (
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          value={quotation.notes || ''}
                          onChange={(e) => setQuotation(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="Additional notes for this quotation..."
                        />
                      </div>
                    )}

                    {/* Signature Upload */}
                    {selectedTemplate.settings.showSignature && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
                        <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-400 transition-colors">
                          {quotation.signature ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img
                                src={quotation.signature}
                                alt="Signature"
                                className="max-h-28 max-w-full object-contain"
                              />
                              <button
                                onClick={() => setQuotation(prev => ({ ...prev, signature: '' }))}
                                className="absolute top-1 right-1 bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-blue-600">
                              <PenTool className="w-8 h-8 mb-2" />
                              <span className="text-sm">Upload Signature</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      setQuotation(prev => ({ ...prev, signature: ev.target?.result as string }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {/* QR Code Upload */}
                    {selectedTemplate.settings.showPaymentQr && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment QR Code</label>
                        <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-md hover:border-blue-400 transition-colors">
                          {quotation.paymentQr ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <img
                                src={quotation.paymentQr}
                                alt="Payment QR"
                                className="max-h-28 max-w-full object-contain"
                              />
                              <button
                                onClick={() => setQuotation(prev => ({ ...prev, paymentQr: '' }))}
                                className="absolute top-1 right-1 bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-blue-600">
                              <FileText className="w-8 h-8 mb-2" />
                              <span className="text-sm">Upload QR Code</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      setQuotation(prev => ({ ...prev, paymentQr: ev.target?.result as string }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Terms & Conditions */}
                    {selectedTemplate.settings.showTermsConditions && (
                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                        <textarea
                          value={quotation.terms || ''}
                          onChange={(e) => setQuotation(prev => ({ ...prev, terms: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                          placeholder="1. Goods once sold will not be taken back or exchanged.&#10;2. All disputes are subject to local jurisdiction only."
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-end bg-white rounded-lg border border-gray-200 p-4 sticky bottom-4">
                <button
                  onClick={() => { resetForm(); setView('home'); }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreviewCurrentQuotation}
                  className="px-4 py-2 border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 order-3 sm:order-2"
                  title="Preview (Ctrl+P)"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={exportPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 order-1 sm:order-3"
                  title="Export PDF (Ctrl+E)"
                >
                  <FileDown className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={saveQuotation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 order-4"
                  title="Save (Ctrl+S)"
                >
                  <Save className="w-4 h-4" />
                  {editingQuotationId ? 'Update' : 'Save'} Quotation
                </button>
              </div>
            </div>
          )}

          {/* Quotation History */}
          {view === 'list' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Quotation History</h2>
                <button
                  onClick={startNewQuotation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  New Quotation
                </button>
              </div>
              <QuotationList
                quotations={quotations}
                onEdit={editQuotation}
                onDelete={deleteQuotation}
                onDuplicate={duplicateQuotation}
                onConvertToInvoice={convertToInvoice}
              />
            </div>
          )}

          {/* New Invoice */}
          {view === 'newInvoice' && (
            <div className="max-w-4xl mx-auto text-center py-16">
              <Receipt className="w-16 h-16 mx-auto text-amber-400 mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Create New Invoice</h2>
              <p className="text-gray-500 mb-6">Start a blank invoice or convert from a quotation.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={startNewInvoice}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Receipt className="w-5 h-5" />
                  Blank Invoice
                </button>
                <button
                  onClick={() => navigateTo('list')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  From Quotation
                </button>
              </div>
            </div>
          )}

          {/* Edit Invoice */}
          {view === 'editInvoice' && editingInvoice && (
            <InvoiceForm
              invoice={editingInvoice}
              catalog={catalog}
              companyProfile={companyProfile}
              selectedTemplate={invoiceTemplate}
              onChange={setEditingInvoice}
              onSave={saveInvoice}
              onExportPDF={exportInvoicePDF}
              onPreview={previewInvoice}
              onCancel={() => { setEditingInvoice(null); setView('invoiceList'); }}
            />
          )}

          {/* Invoice History */}
          {view === 'invoiceList' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Invoice History</h2>
                <button
                  onClick={startNewInvoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                >
                  <Receipt className="w-4 h-4" />
                  New Invoice
                </button>
              </div>
              <InvoiceList
                invoices={invoices}
                onEdit={editInvoice}
                onDelete={deleteInvoice}
                onDuplicate={duplicateInvoice}
              />
            </div>
          )}

          {/* Templates */}
          {view === 'templates' && (
            <div className="max-w-5xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Quotation Templates</h2>
                <p className="text-sm text-gray-500">Create custom quotation layouts with drag-and-drop editor</p>
              </div>
              <TemplateLibrary
                templates={templates}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
                onDuplicate={handleDuplicateTemplate}
                onSetDefault={handleSetDefaultTemplate}
                onPreview={handlePreviewTemplate}
                onCreateNew={handleCreateNewTemplate}
              />
            </div>
          )}

          {/* Product Catalog */}
          {view === 'catalog' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Product Catalog</h2>
              <ProductCatalog catalog={catalog} onSave={handleSaveCatalog} />
            </div>
          )}

          {/* Settings */}
          {view === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Settings</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6 space-y-4">
                  <button
                    onClick={() => setShowCompanyProfile(true)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-800">Company Profile</div>
                        <div className="text-sm text-gray-500">Edit company details, logo, and bank information</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>

                  <button
                    onClick={() => navigateTo('templates')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Layout className="w-5 h-5 text-purple-600" />
                      <div>
                        <div className="font-medium text-gray-800">Quotation Templates</div>
                        <div className="text-sm text-gray-500">Design custom quotation layouts</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>

                  <button
                    onClick={() => navigateTo('catalog')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-amber-600" />
                      <div>
                        <div className="font-medium text-gray-800">Product Catalog</div>
                        <div className="text-sm text-gray-500">Manage default products and prices</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <NumberingSettingsPanel
                  settings={numberingSettings}
                  onSave={(s) => {
                    storage.saveNumberingSettings(s);
                    setNumberingSettings(s);
                  }}
                />
              </div>

              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-800 mb-2">Data Storage</h3>
                <p className="text-sm text-amber-700">
                  All your data is stored locally in your browser. Clearing browser data will remove all quotations and settings.
                  Consider exporting important quotations to PDF for backup.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Company Profile Modal */}
      {showCompanyProfile && (
        <CompanyProfileModal
          profile={companyProfile}
          onSave={handleSaveCompanyProfile}
          onClose={() => setShowCompanyProfile(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcutsModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Navigation</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">New Quotation</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+N</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">New Invoice</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+I</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Quotation History</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+H</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Invoice History</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+J</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Templates</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+T</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Dashboard</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+D</kbd>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Save</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+S</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Preview</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+P</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Export PDF</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Ctrl+E</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Add Product</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Alt+A</kbd>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">General</p>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-700">Go Back / Dashboard</span>
                  <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">ESC</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Builder Modal */}
      {showTemplateBuilder && (
        <TemplateBuilder
          template={editingTemplate || {
            id: '',
            name: 'New Template',
            description: '',
            blocks: [],
            productColumns: getDefaultProductColumns(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          companyProfile={companyProfile}
          sampleData={getSampleData()}
          onSave={handleSaveTemplate}
          onClose={() => {
            setShowTemplateBuilder(false);
            setEditingTemplate(null);
          }}
        />
      )}

      {/* Template Preview Modal */}
      {previewingTemplate && (
        <TemplatePreview
          template={previewingTemplate}
          company={companyProfile}
          customer={previewType === 'invoice' && editingInvoice ? editingInvoice.customer : customer}
          quotation={previewType === 'invoice' && editingInvoice ? {
            id: editingInvoice.id,
            quotationNumber: editingInvoice.invoiceNumber,
            date: editingInvoice.date,
            customer: editingInvoice.customer,
            shipTo: editingInvoice.shipTo,
            products: editingInvoice.products,
            totalAmount: editingInvoice.totalAmount,
            totalCgst: editingInvoice.totalCgst,
            totalSgst: editingInvoice.totalSgst,
            roundOff: editingInvoice.roundOff,
            grandTotal: editingInvoice.grandTotal,
            createdAt: editingInvoice.createdAt,
            selectedTemplateId: editingInvoice.selectedTemplateId,
            productColumns: editingInvoice.productColumns,
            gstMode: editingInvoice.gstMode,
            notes: editingInvoice.notes,
            signature: editingInvoice.signature,
            paymentQr: editingInvoice.paymentQr,
            terms: editingInvoice.terms,
          } as Quotation : buildCurrentQuotation()}
          products={previewType === 'invoice' && editingInvoice ? editingInvoice.products : products}
          onClose={() => { setPreviewingTemplate(null); setPreviewType('quotation'); }}
          documentType={previewType}
          invoice={previewType === 'invoice' ? editingInvoice! : undefined}
          gstMode={previewType === 'invoice' && editingInvoice ? editingInvoice.gstMode || 'inclusive' : gstMode}
        />
      )}
    </div>
  );
}

export default App;
