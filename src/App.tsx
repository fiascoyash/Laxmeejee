import { useState, useEffect } from 'react';
import { useEscapeStack } from './hooks/useEscapeStack';
import { CompanyProfile, Customer, Product, ProductCatalogItem, Quotation, QuotationTemplate, Invoice, InvoiceStatus, NumberingSettings, TableColumn, GstMode, ShipTo, CustomerData, SupplierData, InvoicePayment, DEFAULT_TEMPLATE_SETTINGS } from './types';
import { storage, generateId, generateQuotationNumber, generateInvoiceNumber, convertQuotationToInvoice, calculateTaxSummary, getDefaultProductColumns, incrementQuotationNumber, incrementInvoiceNumber, calculateRoundOff, roundTo2, calculateGrandTotalAmount, bulkMarkInvoicesPaid } from './utils/storage';
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
import { CustomerList } from './components/CustomerList';
import { CustomerForm } from './components/CustomerForm';
import { CustomerHistory } from './components/CustomerHistory';
import { SupplierList } from './components/SupplierList';
import { SupplierForm } from './components/SupplierForm';
import { SupplierLedger } from './components/SupplierLedger';
import { SmartBillImport } from './features/smart-bill-import';
import { GstReports } from './components/GstReports';
import { Dashboard } from './components/Dashboard';
import { PaymentModal } from './components/PaymentModal';
import { PaymentDecisionModal, PaymentDecision } from './components/PaymentDecisionModal';
import { exportTemplatePDF } from './utils/templatePdfExport';
import { isValidMobile, isValidGstin } from './utils/validation';
import { Sun, FileText, Package, Settings, FileDown, Save, List, Building2, Menu, X, Home, ChevronRight, LayoutGrid as Layout, Eye, Receipt, Trash2, PenTool, type LucideIcon, Keyboard, Users, Truck, Zap, BarChart3, AlertCircle } from 'lucide-react';
import { DuplicateDocumentDialog } from './components/DuplicateDocumentDialog';
import { SimilarDocumentDialog } from './components/SimilarDocumentDialog';
import { PrintCenter } from './components/PrintCenter';
import { Printer } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

type View = 'home' | 'selectTemplate' | 'new' | 'list' | 'catalog' | 'settings' | 'templates' | 'newInvoice' | 'invoiceList' | 'editInvoice' | 'customers' | 'suppliers' | 'smartImport' | 'gstReports';

const VALID_VIEWS: View[] = ['home', 'selectTemplate', 'new', 'list', 'catalog', 'settings', 'templates', 'newInvoice', 'invoiceList', 'editInvoice', 'customers', 'suppliers', 'smartImport', 'gstReports'];

function getViewFromHash(): View {
  const hash = window.location.hash.replace('#', '');
  if (VALID_VIEWS.includes(hash as View)) return hash as View;
  return 'home';
}

function App() {
  const [view, setView] = useState<View>(getViewFromHash);
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
  const [productColumns, setProductColumns] = useState<TableColumn[]>(() => {
    const saved = storage.getLastUsedColumns();
    return saved && saved.length > 0 ? saved : getDefaultProductColumns();
  });
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
  const [showPrintCenter, setShowPrintCenter] = useState(false);
  const [printCenterDocType, setPrintCenterDocType] = useState<'quotation' | 'invoice'>('quotation');

  // Customer Management State
  const [customers, setCustomers] = useState<CustomerData[]>(storage.getCustomers);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerData | null>(null);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  // Invoice that passed validation and is awaiting a save decision (Draft /
  // Unpaid / Receive payment / Mark fully paid). The decision modal reads from
  // this; applyPaymentDecision performs the actual save once chosen.
  const [pendingSaveInvoice, setPendingSaveInvoice] = useState<Invoice | null>(null);

  // Duplicate document number blocking dialogs
  const [duplicateQtWarning, setDuplicateQtWarning] = useState<{ number: string; customerName: string; date: string } | null>(null);
  const [duplicateInvWarning, setDuplicateInvWarning] = useState<{ number: string; customerName: string; date: string } | null>(null);
  // Similar document soft-warning dialogs
  const [similarQtPending, setSimilarQtPending] = useState<{ quotation: Quotation; isNew: boolean } | null>(null);
  const [similarInvPending, setSimilarInvPending] = useState<Invoice | null>(null);

  // Supplier / Vendor Management State
  const [suppliers, setSuppliers] = useState<SupplierData[]>(storage.getSuppliers);
  const [editingSupplier, setEditingSupplier] = useState<SupplierData | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<SupplierData | null>(null);

  // Sync view state to URL hash and listen for hashchange (back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash());
      setSidebarOpen(false);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Load data on mount
  useEffect(() => {
    setQuotations(storage.getQuotations);
    setCatalog(storage.getProductCatalog);
    setTemplates(storage.getTemplates);
    setInvoices(storage.getInvoices);
    setCustomers(storage.getCustomers);
    setSuppliers(storage.getSuppliers);
    // Set default template as selected
    const defaultTemplate = storage.getDefaultTemplate();
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, []);

  // Persist column configuration whenever it changes
  // Persist column configuration whenever it changes
  useEffect(() => {
    if (productColumns && productColumns.length > 0) {
      storage.saveLastUsedColumns(productColumns);
    }
  }, [productColumns]);

  // Persist invoice column configuration when editing invoice changes
  useEffect(() => {
    if (editingInvoice?.productColumns && editingInvoice.productColumns.length > 0) {
      storage.saveLastUsedColumns(editingInvoice.productColumns);
    }
  }, [editingInvoice?.productColumns]);

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

      // Ctrl+P → Print Center (auto-save first, then open Print Center)
      if (isCtrlOrCmd && event.key === 'p') {
        event.preventDefault();
        if (view === 'new') {
          openPrintCenterQuotation();
        } else if (view === 'editInvoice') {
          openPrintCenterInvoice();
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
            hsnSacCode: '',
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

  // Centralized ESC handling via escape stack.
  // Each overlay registers itself with a priority. The provider's capture-phase
  // listener calls only the topmost handler. Page-level back navigation is
  // priority 5 so it only fires when no overlays remain.
  useEscapeStack(showShortcutsModal ? () => setShowShortcutsModal(false) : null, 3);
  useEscapeStack(previewingTemplate ? () => { setPreviewingTemplate(null); setPreviewType('quotation'); } : null, 3);
  useEscapeStack(showTemplateBuilder ? () => { setShowTemplateBuilder(false); setEditingTemplate(null); } : null, 3);
  useEscapeStack(showCompanyProfile ? () => setShowCompanyProfile(false) : null, 3);
  useEscapeStack(paymentInvoice ? () => setPaymentInvoice(null) : null, 3);
  useEscapeStack(pendingSaveInvoice ? () => setPendingSaveInvoice(null) : null, 3);
  useEscapeStack(duplicateQtWarning ? () => setDuplicateQtWarning(null) : null, 3);
  useEscapeStack(duplicateInvWarning ? () => setDuplicateInvWarning(null) : null, 3);
  useEscapeStack(similarQtPending ? () => setSimilarQtPending(null) : null, 3);
  useEscapeStack(similarInvPending ? () => setSimilarInvPending(null) : null, 3);
  useEscapeStack(viewingCustomer ? () => setViewingCustomer(null) : null, 3);
  useEscapeStack(viewingSupplier ? () => setViewingSupplier(null) : null, 3);
  useEscapeStack(showCustomerForm ? () => setShowCustomerForm(false) : null, 3);
  useEscapeStack(showSupplierForm ? () => setShowSupplierForm(false) : null, 3);

  // Page-level back navigation (priority 5 — lowest, fires only when no overlays active)
  useEscapeStack(
    editingInvoice ? () => { setEditingInvoice(null); navigateTo('invoiceList'); } : null,
    4,
  );
  useEscapeStack(
    (view === 'new' && editingQuotationId) ? () => { resetForm(); navigateTo('list'); } : null,
    4,
  );
  useEscapeStack(
    (view === 'new' && !editingQuotationId) ? () => { resetForm(); navigateTo('home'); } : null,
    5,
  );
  useEscapeStack(
    (view !== 'home' && view !== 'new' && !editingInvoice) ? () => navigateTo('home') : null,
    5,
  );

  // Navigate to a view, clearing any edit states
  const navigateTo = (targetView: View) => {
    // Clear all edit states when navigating
    setEditingInvoice(null);
    // If leaving quotation form, reset it
    if (view === 'new' || view === 'selectTemplate') {
      resetForm();
    }
    if (getViewFromHash() !== targetView) {
      window.location.hash = targetView;
    } else {
      setView(targetView);
    }
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

  const handleSaveNewProduct = (item: ProductCatalogItem) => {
    storage.addCatalogProduct(item);
    setCatalog(prev => [...prev, item]);
  };

  // Payment handlers
  const handleAddPayment = (payment: InvoicePayment) => {
    storage.addPayment(payment);
    storage.updateInvoiceAmountPaid(payment.invoiceId);
    const updatedInvoices = storage.getInvoices();
    setInvoices(updatedInvoices);
    // Keep paymentInvoice and editingInvoice in sync with updated data
    const updatedInv = updatedInvoices.find(i => i.id === payment.invoiceId);
    if (updatedInv) {
      setPaymentInvoice(updatedInv);
      setEditingInvoice(prev => prev && prev.id === payment.invoiceId ? updatedInv : prev);
    }
    // Background sync to Supabase
    (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const sb = createClient(url, key);
        await sb.from('invoice_payments').insert({
          id: payment.id,
          invoice_id: payment.invoiceId,
          date: payment.date,
          amount: payment.amount,
          mode: payment.mode,
          reference: payment.reference || null,
          notes: payment.notes || null,
          created_at: payment.createdAt,
        });
      } catch (_) { /* fire-and-forget */ }
    })();
  };

  const handleDeletePayment = (paymentId: string, invoiceId: string) => {
    storage.deletePayment(paymentId);
    storage.updateInvoiceAmountPaid(invoiceId);
    const updatedInvoices = storage.getInvoices();
    setInvoices(updatedInvoices);
    const updatedInv = updatedInvoices.find(i => i.id === invoiceId);
    if (updatedInv) {
      setPaymentInvoice(updatedInv);
      setEditingInvoice(prev => prev && prev.id === invoiceId ? updatedInv : prev);
    }
    // Background sync to Supabase
    (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const sb = createClient(url, key);
        await sb.from('invoice_payments').delete().eq('id', paymentId);
      } catch (_) { /* fire-and-forget */ }
    })();
  };

  const handleRecordPayment = (invoice: Invoice) => setPaymentInvoice(invoice);

  // Reset quotation form - keeps last used column configuration
  const resetForm = () => {
    setEditingQuotationId(null);
    setQuotationNumber(generateQuotationNumber());
    setQuotationDate(new Date().toISOString().split('T')[0]);
    setCustomer({ name: '', billingAddress: '', mobile: '', district: '', village: '', gstNumber: '' });
    setProducts([]);
    // Keep last used columns instead of resetting to defaults
    const savedColumns = storage.getLastUsedColumns();
    setProductColumns(savedColumns && savedColumns.length > 0 ? savedColumns : getDefaultProductColumns());
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
    }
    // PRIORITY: Use saved column visibility from quotation (most important for persistence)
    // Only fall back to template schema or defaults if no saved columns exist
    if (quotation.productColumns && quotation.productColumns.length > 0) {
      setProductColumns(quotation.productColumns);
    } else if (quotation.selectedTemplateId) {
      const template = storage.getTemplateById(quotation.selectedTemplateId);
      if (template?.schema?.productColumns) {
        setProductColumns(template.schema.productColumns);
      } else {
        setProductColumns(getDefaultProductColumns());
      }
    } else {
      setProductColumns(getDefaultProductColumns());
    }
    setView('new');
  };

  // Save quotation
  const saveQuotation = () => {
    if (!customer.name) {
      alert('Please enter customer name');
      return;
    }
    if (customer.mobile && !isValidMobile(customer.mobile)) {
      alert('Please enter a valid 10-digit mobile number or leave it blank');
      return;
    }
    if (customer.gstNumber && !isValidGstin(customer.gstNumber)) {
      alert('Please enter a valid 15-character GSTIN or leave it blank');
      return;
    }
    if (shipTo?.mobile && !isValidMobile(shipTo.mobile)) {
      alert('Please enter a valid 10-digit ship-to mobile number or leave it blank');
      return;
    }
    if (shipTo?.gstNumber && !isValidGstin(shipTo.gstNumber)) {
      alert('Please enter a valid 15-character ship-to GSTIN or leave it blank');
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

    const isNew = !editingQuotationId;
    const qNumber = isNew ? generateQuotationNumber() : quotationNumber;

    const newQuotation: Quotation = {
      id: editingQuotationId || generateId(),
      quotationNumber: qNumber,
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

    // Block save if quotation number already exists (for a different quotation)
    const dupQt = quotations.find(q => q.quotationNumber === qNumber && q.id !== editingQuotationId);
    if (dupQt) {
      setDuplicateQtWarning({ number: qNumber, customerName: dupQt.customer.name, date: dupQt.date });
      return;
    }

    // Soft warning: same customer + date + total
    const similarQt = quotations.find(q =>
      q.id !== editingQuotationId &&
      q.customer.name.toLowerCase() === newQuotation.customer.name.toLowerCase() &&
      q.date === newQuotation.date &&
      Math.abs(q.grandTotal - newQuotation.grandTotal) < 0.01
    );
    if (similarQt && isNew) {
      setSimilarQtPending({ quotation: newQuotation, isNew });
      return;
    }

    commitQuotationSave(newQuotation, isNew);
  };

  const commitQuotationSave = (newQuotation: Quotation, isNew: boolean) => {
    storage.saveQuotation(newQuotation);
    newQuotation.products.forEach(p => storage.recordProductUsage(p.name));
    if (isNew) incrementQuotationNumber();
    setQuotations(storage.getQuotations());
    alert(isNew ? 'Quotation saved successfully!' : 'Quotation updated successfully!');
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

  const handleBulkDeleteQuotations = (ids: string[]) => {
    if (confirm(`Delete ${ids.length} quotation${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      ids.forEach(id => storage.deleteQuotation(id));
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

  // Validate the invoice form and compute final totals, then open the
  // Payment Decision dialog so the user chooses how to save (Draft / Unpaid /
  // Receive payment / Mark fully paid). The invoice is NOT persisted here.
  const saveInvoice = () => {
    if (!editingInvoice) return;
    if (!editingInvoice.customer.name) {
      alert('Please enter customer name');
      return;
    }
    if (editingInvoice.customer.mobile && !isValidMobile(editingInvoice.customer.mobile)) {
      alert('Please enter a valid 10-digit mobile number or leave it blank');
      return;
    }
    if (editingInvoice.customer.gstNumber && !isValidGstin(editingInvoice.customer.gstNumber)) {
      alert('Please enter a valid 15-character GSTIN or leave it blank');
      return;
    }
    if (editingInvoice.shipTo?.mobile && !isValidMobile(editingInvoice.shipTo.mobile)) {
      alert('Please enter a valid 10-digit ship-to mobile number or leave it blank');
      return;
    }
    if (editingInvoice.shipTo?.gstNumber && !isValidGstin(editingInvoice.shipTo.gstNumber)) {
      alert('Please enter a valid 15-character ship-to GSTIN or leave it blank');
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

    // Block save if invoice number already exists for a different invoice
    const dupInv = invoices.find(i => i.invoiceNumber === toSave.invoiceNumber && i.id !== toSave.id);
    if (dupInv) {
      setDuplicateInvWarning({ number: toSave.invoiceNumber, customerName: dupInv.customer.name, date: dupInv.date });
      return;
    }

    // Soft warning: same customer + date + total on a new invoice
    const isNewInvoice = !invoices.find(i => i.id === toSave.id);
    if (isNewInvoice) {
      const similarInv = invoices.find(i =>
        i.id !== toSave.id &&
        i.customer.name.toLowerCase() === toSave.customer.name.toLowerCase() &&
        i.date === toSave.date &&
        Math.abs(i.grandTotal - toSave.grandTotal) < 0.01
      );
      if (similarInv) {
        setSimilarInvPending(toSave);
        return;
      }
    }

    setPendingSaveInvoice(toSave);
  };

  // ── Print Center: auto-save before printing ──────────────────────────────
  // Validates the current form, persists silently (no navigation, no alert),
  // then opens the Print Center. If validation or save fails, shows an error
  // and does NOT open the Print Center — unsaved changes are never lost.
  const openPrintCenterQuotation = () => {
    const currentQuotation = buildCurrentQuotation();
    if (!currentQuotation.customer.name) {
      alert('Please enter customer name before printing');
      return;
    }
    if (currentQuotation.products.length === 0) {
      alert('Please add at least one product before printing');
      return;
    }

    const gstMode = currentQuotation.gstMode ?? 'inclusive';
    const taxSummary = calculateTaxSummary(currentQuotation.products, gstMode);
    const totalAmount = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.taxableAmount, 0));
    const totalCgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.cgstAmount, 0));
    const totalSgst = roundTo2(Array.from(taxSummary.values()).reduce((sum, t) => sum + t.sgstAmount, 0));
    const grandTotalAmount = calculateGrandTotalAmount(currentQuotation.products, gstMode);
    const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalAmount);

    const toSave: Quotation = {
      ...currentQuotation,
      totalAmount,
      totalCgst,
      totalSgst,
      roundOff,
      grandTotal: roundedGrandTotal,
    };

    try {
      storage.saveQuotation(toSave);
      setQuotations(storage.getQuotations());
    } catch (e) {
      alert('Failed to save quotation before printing. Please try saving manually.');
      return;
    }

    setPrintCenterDocType('quotation');
    setShowPrintCenter(true);
  };

  const openPrintCenterInvoice = () => {
    if (!editingInvoice) return;
    if (!editingInvoice.customer.name) {
      alert('Please enter customer name before printing');
      return;
    }
    if (editingInvoice.products.length === 0) {
      alert('Please add at least one product before printing');
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

    // Block if duplicate invoice number
    const dupInv = invoices.find(i => i.invoiceNumber === toSave.invoiceNumber && i.id !== toSave.id);
    if (dupInv) {
      alert(`Invoice number "${toSave.invoiceNumber}" already exists. Please use a different number.`);
      return;
    }

    try {
      storage.saveInvoice(toSave);
      setInvoices(storage.getInvoices());
      setEditingInvoice(toSave);
    } catch (e) {
      alert('Failed to save invoice before printing. Please try saving manually.');
      return;
    }

    setPrintCenterDocType('invoice');
    setShowPrintCenter(true);
  };

  // Apply the save decision chosen in the Payment Decision dialog. Persists
  // the invoice, optionally creates a payment entry, and updates status /
  // amount paid / outstanding automatically.
  const applyPaymentDecision = async (decision: PaymentDecision) => {
    const toSave = pendingSaveInvoice;
    if (!toSave) return;
    setPendingSaveInvoice(null);

    const isNewInvoice = !invoices.find(i => i.id === toSave.id);
    const existingPayments = storage.getPaymentsByInvoice(toSave.id);
    const previouslyPaid = existingPayments.reduce((s, p) => s + p.amount, 0);

    let status: InvoiceStatus;
    let paymentToRecord: InvoicePayment | null = null;
    let clearAllPayments = false;

    switch (decision.kind) {
      case 'draft':
        status = 'Draft';
        clearAllPayments = true;
        break;
      case 'unpaid':
        status = 'Unpaid';
        clearAllPayments = true;
        break;
      case 'receive':
        paymentToRecord = decision.payment;
        status = storage.computeInvoiceStatus(
          previouslyPaid + decision.payment.amount,
          toSave.grandTotal,
          false,
        );
        break;
      case 'paid': {
        // Replace all existing payments with one full-payment record
        clearAllPayments = true;
        paymentToRecord = decision.payment;
        status = 'Paid';
        break;
      }
    }

    // Clear payment records when reverting to Draft or Unpaid, or replacing with full-paid
    if (clearAllPayments && existingPayments.length > 0) {
      existingPayments.forEach(p => storage.deletePayment(p.id));
    }

    const invoiceToPersist: Invoice = {
      ...toSave,
      status,
      amountPaid: clearAllPayments && !paymentToRecord
        ? 0
        : paymentToRecord
          ? roundTo2((clearAllPayments ? 0 : previouslyPaid) + paymentToRecord.amount)
          : roundTo2(previouslyPaid),
      updatedAt: new Date().toISOString(),
    };

    storage.saveInvoice(invoiceToPersist);
    if (isNewInvoice) incrementInvoiceNumber();
    invoiceToPersist.products.forEach(p => storage.recordProductUsage(p.name));

    if (paymentToRecord) {
      storage.addPayment(paymentToRecord);
      storage.updateInvoiceAmountPaid(toSave.id);
    } else if (clearAllPayments) {
      // Reconcile the cached amountPaid from now-empty payment records
      storage.updateInvoiceAmountPaid(toSave.id);
    }

    setInvoices(storage.getInvoices());

    // Record stock movements for new, non-Draft sales
    if (isNewInvoice && status !== 'Draft') {
      await recordStockMovementsForSale(invoiceToPersist);
    }

    // Background-sync payment changes to Supabase
    if (clearAllPayments && existingPayments.length > 0) {
      (async () => {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const url = import.meta.env.VITE_SUPABASE_URL;
          const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (!url || !key) return;
          const sb = createClient(url, key);
          await sb.from('invoice_payments').delete().eq('invoice_id', toSave.id);
        } catch (_) { /* fire-and-forget */ }
      })();
    }

    if (paymentToRecord) {
      (async () => {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const url = import.meta.env.VITE_SUPABASE_URL;
          const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (!url || !key) return;
          const sb = createClient(url, key);
          await sb.from('invoice_payments').insert({
            id: paymentToRecord.id,
            invoice_id: paymentToRecord.invoiceId,
            date: paymentToRecord.date,
            amount: paymentToRecord.amount,
            mode: paymentToRecord.mode,
            reference: paymentToRecord.reference || null,
            notes: paymentToRecord.notes || null,
            created_at: paymentToRecord.createdAt,
          });
        } catch (_) { /* fire-and-forget */ }
      })();
    }

    const successMsg =
      status === 'Draft' ? 'Invoice saved as Draft.' :
      status === 'Unpaid' ? 'Invoice saved as Unpaid.' :
      status === 'Paid' ? 'Invoice saved and marked as Paid.' :
      'Invoice saved with partial payment.';
    alert(successMsg);

    setEditingInvoice(null);
    setView('invoiceList');
  };

  // Record stock movements when an invoice is finalized (sold)
  const recordStockMovementsForSale = async (invoice: Invoice) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    for (const product of invoice.products) {
      if (!product.name || product.quantity <= 0) continue;

      // Find the product in catalog to get its ID
      const catalogItem = catalog.find(c => c.name.toLowerCase() === product.name.toLowerCase());
      if (!catalogItem) continue;

      const newStock = catalogItem.stockQuantity - product.quantity;

      // Create stock movement record for sale
      await supabase.from('product_stock_movements').insert({
        product_id: catalogItem.id,
        movement_type: 'sale',
        quantity_change: -product.quantity,
        balance_after: newStock,
        reference_type: 'invoice',
        reference_id: invoice.id,
        notes: `Invoice: ${invoice.invoiceNumber}, Customer: ${invoice.customer.name}`,
      });
    }
  };

  // Delete invoice
  const deleteInvoice = (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      storage.deleteInvoice(id);
      setInvoices(storage.getInvoices());
    }
  };

  const handleBulkDeleteInvoices = (ids: string[]) => {
    if (confirm(`Delete ${ids.length} invoice${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) {
      ids.forEach(id => storage.deleteInvoice(id));
      setInvoices(storage.getInvoices());
    }
  };

  const handleBulkMarkPaid = (ids: string[]) => {
    if (confirm(`Mark ${ids.length} invoice${ids.length !== 1 ? 's' : ''} as Paid?`)) {
      bulkMarkInvoicesPaid(ids);
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
    // Ensure productColumns are properly initialized for existing invoices
    if (!invoice.productColumns || invoice.productColumns.length === 0) {
      const savedColumns = storage.getLastUsedColumns();
      const template = invoice.selectedTemplateId
        ? storage.getTemplateById(invoice.selectedTemplateId)
        : storage.getDefaultTemplate();
      const schemaColumns = savedColumns && savedColumns.length > 0
        ? savedColumns
        : template?.schema?.productColumns || getDefaultProductColumns();
      invoice = { ...invoice, productColumns: schemaColumns };
    }
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
    // Prefer user's persisted columns, then template schema, then defaults
    const savedColumns = storage.getLastUsedColumns();
    const schemaColumns = savedColumns && savedColumns.length > 0
      ? savedColumns
      : template?.schema?.productColumns || getDefaultProductColumns();

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
        { id: '1', name: 'Solar Panel 335W', hsnSacCode: '8541', gstPercent: 18, quantity: 10, unitPrice: 12000 },
        { id: '2', name: 'Solar Inverter 3kW', hsnSacCode: '8504', gstPercent: 18, quantity: 1, unitPrice: 35000 },
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
      { id: '1', name: 'Solar Panel 335W', hsnSacCode: '8541', gstPercent: 18, quantity: 10, unitPrice: 12000 },
      { id: '2', name: 'Solar Inverter 3kW', hsnSacCode: '8504', gstPercent: 18, quantity: 1, unitPrice: 35000 },
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
    // Apply template schema to form - but prefer user's persisted columns
    const template = storage.getTemplateById(templateId);
    const savedColumns = storage.getLastUsedColumns();
    // Use saved columns if available, otherwise use template schema columns
    if (savedColumns && savedColumns.length > 0) {
      setProductColumns(savedColumns);
    } else if (template?.schema?.productColumns) {
      setProductColumns(template.schema.productColumns);
    }
    if (template?.schema?.defaultGstMode) {
      setGstMode(template.schema.defaultGstMode);
    }
    // Immediately navigate to quotation creation
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

  // Customer Management Handlers
  const handleSaveCustomer = (customerData: CustomerData) => {
    const existingCustomer = storage.getCustomerByMobile(customerData.mobile);
    if (existingCustomer && existingCustomer.id !== customerData.id) {
      alert('A customer with this mobile number already exists.');
      return;
    }
    const now = new Date().toISOString();
    const customerToSave: CustomerData = {
      ...customerData,
      id: customerData.id || generateId(),
      createdAt: customerData.createdAt || now,
      updatedAt: now,
    };
    storage.saveCustomer(customerToSave);
    setCustomers(storage.getCustomers);
    setShowCustomerForm(false);
    setEditingCustomer(null);
    setIsExistingCustomer(false);
    alert('Customer saved successfully!');
  };

  const handleDeleteCustomer = (id: string) => {
    storage.deleteCustomer(id);
    setCustomers(storage.getCustomers);
  };

  const handleEditCustomer = (customerData: CustomerData) => {
    setEditingCustomer(customerData);
    setShowCustomerForm(true);
    setViewingCustomer(null);
  };

  const handleViewCustomer = (customerData: CustomerData) => {
    setViewingCustomer(customerData);
  };

  const handleAddCustomerClick = () => {
    setEditingCustomer(null);
    setIsExistingCustomer(false);
    setShowCustomerForm(true);
  };

  // Get customer stats for list
  const getCustomerStats = () => {
    const quotationCounts: Record<string, number> = {};
    const invoiceCounts: Record<string, number> = {};
    const lastActivityDates: Record<string, string> = {};

    quotations.forEach(q => {
      const mobile = q.customer.mobile;
      quotationCounts[mobile] = (quotationCounts[mobile] || 0) + 1;
      const existingDate = lastActivityDates[mobile];
      if (!existingDate || q.date > existingDate) {
        lastActivityDates[mobile] = q.date;
      }
    });

    invoices.forEach(i => {
      const mobile = i.customer.mobile;
      invoiceCounts[mobile] = (invoiceCounts[mobile] || 0) + 1;
      const existingDate = lastActivityDates[mobile];
      if (!existingDate || i.date > existingDate) {
        lastActivityDates[mobile] = i.date;
      }
    });

    return { quotationCounts, invoiceCounts, lastActivityDates };
  };

  // Match a document's embedded customer to a CustomerData record.
  // Mobile is the primary key (the fallback used elsewhere via
  // getCustomerByMobile / searchCustomers). When the customer has no mobile,
  // fall back to a case-insensitive name match. A blank field never matches a
  // blank field — that was the bug that let one customer's invoices/payments
  // leak into another customer's Khata Book.
  const docBelongsToCustomer = (docCustomer: Customer, customer: CustomerData): boolean => {
    const cMobile = customer.mobile?.trim() || '';
    const dMobile = docCustomer.mobile?.trim() || '';
    if (cMobile) return dMobile === cMobile;
    const cName = customer.name?.trim().toLowerCase() || '';
    const dName = docCustomer.name?.trim().toLowerCase() || '';
    return !!cName && cName === dName;
  };

  // Get customer history for viewing — returns only this customer's
  // quotations, invoices, and the payments linked to those invoices.
  const getCustomerHistory = (customer: CustomerData) => {
    const customerQuotations = quotations.filter(q => docBelongsToCustomer(q.customer, customer));
    const customerInvoices = invoices.filter(i => docBelongsToCustomer(i.customer, customer));
    const invoiceIds = new Set(customerInvoices.map(i => i.id));
    const customerPayments = storage.getPayments().filter(p => invoiceIds.has(p.invoiceId));
    return { customerQuotations, customerInvoices, customerPayments };
  };

  // Supplier / Vendor Handlers
  const handleSaveSupplier = (supplierData: SupplierData) => {
    storage.saveSupplier(supplierData);
    setSuppliers(storage.getSuppliers());
    setShowSupplierForm(false);
    setEditingSupplier(null);
  };

  const handleDeleteSupplier = (id: string) => {
    storage.deleteSupplier(id);
    setSuppliers(storage.getSuppliers());
    if (viewingSupplier?.id === id) setViewingSupplier(null);
  };

  const handleEditSupplier = (supplierData: SupplierData) => {
    setEditingSupplier(supplierData);
    setShowSupplierForm(true);
    setViewingSupplier(null);
  };

  const handleViewSupplier = (supplierData: SupplierData) => {
    setViewingSupplier(supplierData);
  };

  const NavItem = ({ icon: Icon, label, currentView, targetView }: {
    icon: LucideIcon;
    label: string;
    currentView: View;
    targetView: View;
  }) => (
    <a
      href={`#${targetView}`}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        navigateTo(targetView);
      }}
      onAuxClick={(e) => { e.preventDefault(); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        currentView === targetView
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </a>
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
          <div className="mt-4 px-3">
            <p className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Management</p>
            <ul className="space-y-1">
              <li><NavItem icon={Users} label="Customers" currentView={view} targetView="customers" /></li>
              <li><NavItem icon={Truck} label="Suppliers" currentView={view} targetView="suppliers" /></li>
              <li><NavItem icon={Layout} label="Templates" currentView={view} targetView="templates" /></li>
              <li><NavItem icon={Package} label="Product Catalog" currentView={view} targetView="catalog" /></li>
              <li><NavItem icon={Zap} label="Smart Bill Import" currentView={view} targetView="smartImport" /></li>
              <li><NavItem icon={Settings} label="Settings" currentView={view} targetView="settings" /></li>
            </ul>
          </div>
          <div className="mt-4 px-3">
            <p className="px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">GST Reports</p>
            <ul className="space-y-1">
              <li><NavItem icon={BarChart3} label="GST Reports" currentView={view} targetView="gstReports" /></li>
            </ul>
          </div>
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
              <a
                href="#home"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                  e.preventDefault();
                  navigateTo('home');
                }}
                className="hover:text-emerald-600 transition-colors"
              >
                Dashboard
              </a>
              {view !== 'home' && (
                <>
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-slate-800 font-medium capitalize">
                    {view === 'selectTemplate' ? 'Select Template' : view === 'newInvoice' ? 'New Invoice' : view === 'invoiceList' ? 'Invoice History' : view === 'editInvoice' ? 'Edit Invoice' : view === 'smartImport' ? 'Smart Bill Import' : view}
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
            <Dashboard
              invoices={invoices}
              quotations={quotations}
              customers={customers}
              suppliers={suppliers}
              catalog={catalog}
              companyProfile={companyProfile}
              onNewInvoice={startNewInvoice}
              onNewQuotation={startNewQuotation}
              onNavigate={(v) => navigateTo(v)}
              onShowCompanyProfile={() => setShowCompanyProfile(true)}
            />
          )}

          {/* Template Selection */}
          {view === 'selectTemplate' && (
            <TemplateSelection
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelect={handleSelectTemplate}
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
                      className={`px-2 py-1 text-sm border rounded font-mono focus:ring-2 w-48 ${
                        quotationNumber && quotations.some(q => q.quotationNumber === quotationNumber && q.id !== editingQuotationId)
                          ? 'border-red-400 text-red-700 bg-red-50 focus:ring-red-500 focus:border-red-400'
                          : 'text-gray-600 border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                    />
                    <span className="text-xs text-gray-400">editable</span>
                  </div>
                  {quotationNumber && quotations.some(q => q.quotationNumber === quotationNumber && q.id !== editingQuotationId) && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Quotation Number already exists. Choose another number.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                  {/* Template indicator */}
                  {selectedTemplate && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md text-sm">
                      <Layout className="w-4 h-4 text-purple-600" />
                      <span className="text-purple-700 font-medium">{selectedTemplate.name}</span>
                      <a
                        href="#selectTemplate"
                        onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); setView('selectTemplate'); }}
                        onAuxClick={(e) => e.preventDefault()}
                        className="text-purple-600 hover:text-purple-800 text-xs underline"
                      >
                        Change
                      </a>
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
                onSaveNewProduct={handleSaveNewProduct}
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
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={openPrintCenterQuotation}
                  className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors flex items-center justify-center gap-2 order-3.5 sm:order-2.5"
                  title="Print (Ctrl+P)"
                >
                  <Printer className="w-4 h-4" />
                  Print
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
                  disabled={!!(quotationNumber && quotations.some(q => q.quotationNumber === quotationNumber && q.id !== editingQuotationId))}
                  className={`px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 order-4 ${
                    quotationNumber && quotations.some(q => q.quotationNumber === quotationNumber && q.id !== editingQuotationId)
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={quotationNumber && quotations.some(q => q.quotationNumber === quotationNumber && q.id !== editingQuotationId) ? 'Fix duplicate quotation number to save' : 'Save (Ctrl+S)'}
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
                <a
                  href="#selectTemplate"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); startNewQuotation(); }}
                  onAuxClick={(e) => e.preventDefault()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  New Quotation
                </a>
              </div>
              <QuotationList
                quotations={quotations}
                onEdit={editQuotation}
                onDelete={deleteQuotation}
                onDuplicate={duplicateQuotation}
                onConvertToInvoice={convertToInvoice}
                onBulkDelete={handleBulkDeleteQuotations}
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
                <a
                  href="#newInvoice"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); startNewInvoice(); }}
                  onAuxClick={(e) => e.preventDefault()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Receipt className="w-5 h-5" />
                  Blank Invoice
                </a>
                <a
                  href="#list"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigateTo('list'); }}
                  onAuxClick={(e) => e.preventDefault()}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  From Quotation
                </a>
              </div>
            </div>
          )}

          {/* Edit Invoice */}
          {view === 'editInvoice' && editingInvoice && (
            <InvoiceForm
              invoice={editingInvoice}
              allInvoices={invoices}
              catalog={catalog}
              companyProfile={companyProfile}
              selectedTemplate={invoiceTemplate}
              onChange={setEditingInvoice}
              onSave={saveInvoice}
              onExportPDF={exportInvoicePDF}
              onPreview={previewInvoice}
              onPrint={openPrintCenterInvoice}
              onCancel={() => { setEditingInvoice(null); setView('invoiceList'); }}
              onSaveNewProduct={handleSaveNewProduct}
              onRecordPayment={handleRecordPayment}
            />
          )}

          {/* Invoice History */}
          {view === 'invoiceList' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Invoice History</h2>
                <a
                  href="#newInvoice"
                  onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); startNewInvoice(); }}
                  onAuxClick={(e) => e.preventDefault()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                >
                  <Receipt className="w-4 h-4" />
                  New Invoice
                </a>
              </div>
              <InvoiceList
                invoices={invoices}
                onEdit={editInvoice}
                onDelete={deleteInvoice}
                onDuplicate={duplicateInvoice}
                onRecordPayment={handleRecordPayment}
                onBulkDelete={handleBulkDeleteInvoices}
                onBulkMarkPaid={handleBulkMarkPaid}
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

          {/* Customers */}
          {view === 'customers' && (
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Customers</h2>
                <p className="text-sm text-gray-500">Manage your customer database</p>
              </div>
              <CustomerList
                customers={customers}
                onView={handleViewCustomer}
                onEdit={handleEditCustomer}
                onDelete={handleDeleteCustomer}
                onAdd={handleAddCustomerClick}
                quotationCounts={getCustomerStats().quotationCounts}
                invoiceCounts={getCustomerStats().invoiceCounts}
                lastActivityDates={getCustomerStats().lastActivityDates}
              />
            </div>
          )}

          {/* Suppliers */}
          {view === 'suppliers' && (
            <div className="max-w-6xl mx-auto">
              {viewingSupplier ? (
                <SupplierLedger
                  supplier={viewingSupplier}
                  onBack={() => setViewingSupplier(null)}
                  onEdit={(s) => { handleEditSupplier(s); }}
                />
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Suppliers / Vendors</h2>
                    <p className="text-sm text-gray-500">Manage your supplier ledger and purchase history</p>
                  </div>
                  <SupplierList
                    suppliers={suppliers}
                    onView={handleViewSupplier}
                    onEdit={handleEditSupplier}
                    onDelete={handleDeleteSupplier}
                    onAdd={() => { setEditingSupplier(null); setShowSupplierForm(true); }}
                  />
                </>
              )}
            </div>
          )}

          {/* Product Catalog */}
          {view === 'catalog' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Product Catalog</h2>
              <ProductCatalog catalog={catalog} onSave={handleSaveCatalog} businessType={companyProfile.businessType} suppliers={suppliers} />
            </div>
          )}

          {/* Smart Bill Import */}
          {view === 'smartImport' && (
            <SmartBillImport
                catalog={catalog}
                onCatalogChange={handleSaveCatalog}
                suppliers={suppliers}
              />
          )}

          {/* GST Reports */}
          {view === 'gstReports' && (
            <GstReports
              invoices={invoices}
              companyProfile={companyProfile}
            />
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

                  <a
                    href="#templates"
                    onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigateTo('templates'); }}
                    onAuxClick={(e) => e.preventDefault()}
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
                  </a>

                  <a
                    href="#catalog"
                    onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigateTo('catalog'); }}
                    onAuxClick={(e) => e.preventDefault()}
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
                  </a>
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
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Field Navigation</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Next Field</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Enter</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Previous Field</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Shift+Enter</kbd>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Catalog Dropdown</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Navigate</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Up</kbd>
                      <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Down</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-700">Select Item</span>
                    <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs font-mono">Enter</kbd>
                  </div>
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

      {/* Supplier Form Modal */}
      {showSupplierForm && (
        <SupplierForm
          supplier={editingSupplier}
          onSave={handleSaveSupplier}
          onCancel={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
        />
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (        <CustomerForm
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          onCancel={() => {
            setShowCustomerForm(false);
            setEditingCustomer(null);
            setIsExistingCustomer(false);
          }}
          isExistingCustomer={isExistingCustomer}
        />
      )}

      {/* Customer History / Khata Book Modal */}
      {viewingCustomer && (() => {
        const history = getCustomerHistory(viewingCustomer);
        return (
        <CustomerHistory
          customer={viewingCustomer}
          quotations={history.customerQuotations}
          invoices={history.customerInvoices}
          payments={history.customerPayments}
          onClose={() => setViewingCustomer(null)}
          onEditQuotation={(q) => {
            setViewingCustomer(null);
            editQuotation(q);
          }}
          onEditInvoice={(i) => {
            setViewingCustomer(null);
            editInvoice(i);
          }}
          onRecordPayment={(inv) => {
            setPaymentInvoice(inv);
          }}
        />
        );
      })()}

      {/* Payment Modal */}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          payments={storage.getPaymentsByInvoice(paymentInvoice.id)}
          onAddPayment={handleAddPayment}
          onDeletePayment={handleDeletePayment}
          onClose={() => setPaymentInvoice(null)}
        />
      )}

      {/* Payment Decision Modal — shown after Save Invoice is validated */}
      {pendingSaveInvoice && (
        <PaymentDecisionModal
          invoice={pendingSaveInvoice}
          existingPayments={storage.getPaymentsByInvoice(pendingSaveInvoice.id)}
          onConfirm={applyPaymentDecision}
          onClose={() => setPendingSaveInvoice(null)}
        />
      )}

      {/* Duplicate Quotation Number — blocking dialog */}
      {duplicateQtWarning && (
        <DuplicateDocumentDialog
          type="quotation"
          duplicateNumber={duplicateQtWarning.number}
          existingCustomerName={duplicateQtWarning.customerName}
          existingDate={duplicateQtWarning.date}
          onClose={() => setDuplicateQtWarning(null)}
        />
      )}

      {/* Duplicate Invoice Number — blocking dialog */}
      {duplicateInvWarning && (
        <DuplicateDocumentDialog
          type="invoice"
          duplicateNumber={duplicateInvWarning.number}
          existingCustomerName={duplicateInvWarning.customerName}
          existingDate={duplicateInvWarning.date}
          onClose={() => setDuplicateInvWarning(null)}
        />
      )}

      {/* Similar Quotation — soft non-blocking warning */}
      {similarQtPending && (
        <SimilarDocumentDialog
          type="quotation"
          customerName={similarQtPending.quotation.customer.name}
          amount={similarQtPending.quotation.grandTotal}
          date={similarQtPending.quotation.date}
          onCancel={() => setSimilarQtPending(null)}
          onProceed={() => {
            const { quotation, isNew } = similarQtPending;
            setSimilarQtPending(null);
            commitQuotationSave(quotation, isNew);
          }}
        />
      )}

      {/* Similar Invoice — soft non-blocking warning */}
      {similarInvPending && (
        <SimilarDocumentDialog
          type="invoice"
          customerName={similarInvPending.customer.name}
          amount={similarInvPending.grandTotal}
          date={similarInvPending.date}
          onCancel={() => setSimilarInvPending(null)}
          onProceed={() => {
            const toSave = similarInvPending;
            setSimilarInvPending(null);
            setPendingSaveInvoice(toSave);
          }}
        />
      )}

      {/* Enterprise Print Center */}
      {showPrintCenter && (() => {
        const template = getCurrentTemplate();
        const settings = template?.settings ?? DEFAULT_TEMPLATE_SETTINGS;
        const themeId = template?.themeId ?? 'professional_corporate';
        const blocks = template?.blocks ?? [];
        const tplSchema = template?.schema;

        if (printCenterDocType === 'invoice' && editingInvoice) {
          const invTemplate = editingInvoice.selectedTemplateId
            ? storage.getTemplateById(editingInvoice.selectedTemplateId)
            : template;
          const invSettings = invTemplate?.settings ?? settings;
          const invThemeId = invTemplate?.themeId ?? themeId;
          const invBlocks = invTemplate?.blocks ?? blocks;
          const invSchema = invTemplate?.schema ?? tplSchema;

          return (
            <PrintCenter
              open={showPrintCenter}
              onClose={() => setShowPrintCenter(false)}
              docType="invoice"
              company={companyProfile}
              customer={editingInvoice.customer}
              quotation={editingInvoice as unknown as Quotation}
              products={editingInvoice.products}
              invoice={editingInvoice}
              templateSettings={invSettings}
              customBlocks={invBlocks}
              schema={invSchema}
              themeId={invThemeId}
            />
          );
        }

        const currentQuotation = buildCurrentQuotation();
        return (
          <PrintCenter
            open={showPrintCenter}
            onClose={() => setShowPrintCenter(false)}
            docType="quotation"
            company={companyProfile}
            customer={customer}
            quotation={currentQuotation}
            products={products}
            templateSettings={settings}
            customBlocks={blocks}
            schema={tplSchema}
            themeId={themeId}
          />
        );
      })()}
    </div>
  );
}

export default App;
