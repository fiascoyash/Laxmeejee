import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, X, Check, FileText, Building2, User, Receipt, Truck, Package, IndianRupee, FileClock } from 'lucide-react';
import { DocumentRenderer } from './DocumentRenderer';
import { CompanyProfile, Customer, Quotation, Product, TemplateSettings, Invoice, ThemeId, TemplateBlock, TemplateSchema } from '../types';

export type PrintPaperSize = 'a2' | 'a3' | 'a4' | 'a5' | 'thermal58' | 'thermal80';
export type PrintProfileId =
  | 'office_copy'
  | 'customer_copy'
  | 'receipt_pos'
  | 'delivery_challan'
  | 'packing_slip'
  | 'payment_receipt'
  | 'quotation_copy';
export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintSettings {
  paperSize: PrintPaperSize;
  profile: PrintProfileId;
  orientation: PrintOrientation;
  margins: number; // mm
  thermalWidth: 58 | 80;
}

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paperSize: 'a4',
  profile: 'office_copy',
  orientation: 'portrait',
  margins: 10,
  thermalWidth: 80,
};

const SETTINGS_KEY = 'printCenterSettings';

function loadSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_PRINT_SETTINGS;
}

function saveSettings(s: PrintSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Paper size definitions ──────────────────────────────────────────────────
interface PaperDef {
  id: PrintPaperSize;
  label: string;
  widthMm: number;
  heightMm: number;
  orientation: PrintOrientation;
  recommended: string;
}

const PAPER_DEFS: Record<PrintPaperSize, PaperDef> = {
  a2: { id: 'a2', label: 'A2 Invoice', widthMm: 420, heightMm: 594, orientation: 'portrait', recommended: 'Large-format printing, big invoices with many line items' },
  a3: { id: 'a3', label: 'A3 Invoice', widthMm: 297, heightMm: 420, orientation: 'portrait', recommended: 'Detailed invoices with extensive tax breakdowns' },
  a4: { id: 'a4', label: 'A4 GST Invoice', widthMm: 210, heightMm: 297, orientation: 'portrait', recommended: 'Standard GST invoice for office and customer copies' },
  a5: { id: 'a5', label: 'A5 Invoice', widthMm: 148, heightMm: 210, orientation: 'portrait', recommended: 'Compact quick bills for retail and counter sales' },
  thermal58: { id: 'thermal58', label: 'Thermal Receipt (58mm / 2-inch)', widthMm: 58, heightMm: 0, orientation: 'portrait', recommended: '2-inch thermal POS printer, auto-height receipt' },
  thermal80: { id: 'thermal80', label: 'Thermal Receipt (80mm / 3-inch)', widthMm: 80, heightMm: 0, orientation: 'portrait', recommended: '3-inch thermal POS printer, auto-height receipt' },
};

const PAPER_ORDER: PrintPaperSize[] = ['a2', 'a3', 'a4', 'a5', 'thermal58', 'thermal80'];

// ── Print profile definitions ────────────────────────────────────────────────
interface ProfileDef {
  id: PrintProfileId;
  label: string;
  icon: typeof Building2;
  description: string;
  /** Paper sizes this profile is compatible with (empty = all) */
  compatibleSizes?: PrintPaperSize[];
}

const PROFILE_DEFS: ProfileDef[] = [
  { id: 'office_copy', label: 'Office Copy', icon: Building2, description: 'Full GST invoice with complete tax summary, HSN/SAC, bank details, signature, and terms & conditions.' },
  { id: 'customer_copy', label: 'Customer Copy', icon: User, description: 'Same as office copy but displays a "CUSTOMER COPY" watermark on the document.' },
  { id: 'receipt_pos', label: 'Receipt / POS', icon: Receipt, description: 'Compact receipt format optimized for 2-inch and 3-inch thermal printers. Auto height, minimal margins.', compatibleSizes: ['thermal58', 'thermal80'] },
  { id: 'delivery_challan', label: 'Delivery Challan', icon: Truck, description: 'Hides prices, GST, tax summary, and grand total. Shows only products, quantity, delivery, receiver, and company details.' },
  { id: 'packing_slip', label: 'Packing Slip', icon: Package, description: 'Shows only products, quantity, unit, and description. Hides rates, GST, amount, grand total, and payment info.' },
  { id: 'payment_receipt', label: 'Payment Receipt', icon: IndianRupee, description: 'Shows invoice reference, customer, payment received, payment mode, reference number, date, outstanding balance, company details, and receipt number. Hides item table.' },
  { id: 'quotation_copy', label: 'Quotation Copy', icon: FileClock, description: 'Professional quotation layout with quotation watermark, quotation number, and quotation validity. No payment information.' },
];

// ── Profile → settings overrides ─────────────────────────────────────────────
function applyProfileToSettings(
  base: TemplateSettings,
  profile: PrintProfileId,
): TemplateSettings {
  switch (profile) {
    case 'office_copy':
      return { ...base };
    case 'customer_copy':
      return { ...base, showWatermark: true };
    case 'receipt_pos':
      return {
        ...base,
        showTaxSummary: false,
        showBankDetails: false,
        showPaymentQr: false,
        showSignature: false,
        showTermsConditions: false,
        showNotes: false,
      };
    case 'delivery_challan':
      return {
        ...base,
        showTaxSummary: false,
        showBankDetails: false,
        showPaymentQr: false,
        showSignature: false,
        showTermsConditions: false,
        showTax: false,
        showDiscount: false,
      };
    case 'packing_slip':
      return {
        ...base,
        showTaxSummary: false,
        showBankDetails: false,
        showPaymentQr: false,
        showSignature: false,
        showTermsConditions: false,
        showTax: false,
        showDiscount: false,
      };
    case 'payment_receipt':
      return {
        ...base,
        showTaxSummary: false,
        showBankDetails: false,
        showPaymentQr: false,
        showSignature: false,
        showTermsConditions: false,
        showNotes: false,
      };
    case 'quotation_copy':
      return { ...base, showWatermark: true };
    default:
      return base;
  }
}

// ── Map PrintPaperSize to ThemeId for DocumentRenderer ────────────────────────
function paperToThemeId(paper: PrintPaperSize): ThemeId {
  switch (paper) {
    case 'a2':
    case 'a3':
    case 'a4':
      return 'professional_corporate';
    case 'a5':
      return 'a5_retail';
    case 'thermal58':
    case 'thermal80':
      return 'pos_compact';
    default:
      return 'professional_corporate';
  }
}

// ── Preview scale: fit paper width into preview container ─────────────────────
function getPreviewScale(paperMm: number, containerPx: number): number {
  // 1mm ≈ 3.78px at 96dpi
  const paperPx = paperMm * 3.78;
  if (paperPx <= containerPx) return 1;
  return containerPx / paperPx;
}

// ── Payment receipt data ─────────────────────────────────────────────────────
interface PaymentReceiptData {
  receiptNumber: string;
  amountReceived: number;
  paymentMode: string;
  referenceNumber: string;
  paymentDate: string;
  outstandingBalance: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  docType: 'quotation' | 'invoice';
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  invoice?: Invoice;
  templateSettings: TemplateSettings;
  customBlocks?: TemplateBlock[];
  schema?: TemplateSchema;
  themeId: ThemeId;
  paymentReceiptData?: PaymentReceiptData;
}

export function PrintCenter({
  open,
  onClose,
  docType,
  company,
  customer,
  quotation,
  products,
  invoice,
  templateSettings,
  customBlocks = [],
  schema,
  themeId: _themeId,
  paymentReceiptData,
}: Props) {
  const [settings, setSettings] = useState<PrintSettings>(loadSettings);
  const previewRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!open || !previewRef.current) return;
    const updateWidth = () => {
      if (previewRef.current) {
        setContainerWidth(previewRef.current.clientWidth - 32);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [open]);

  const update = useCallback((patch: Partial<PrintSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  // When profile changes, auto-select compatible paper if needed
  const handleProfileChange = useCallback((profile: PrintProfileId) => {
    const def = PROFILE_DEFS.find(p => p.id === profile);
    if (def?.compatibleSizes && def.compatibleSizes.length > 0) {
      if (!def.compatibleSizes.includes(settings.paperSize)) {
        update({ profile, paperSize: def.compatibleSizes[0] });
        return;
      }
    }
    update({ profile });
  }, [settings.paperSize, update]);

  // Build the effective template settings for the selected profile
  const effectiveSettings: TemplateSettings = applyProfileToSettings(
    templateSettings,
    settings.profile,
  );

  // For thermal, override margins to minimal
  const isThermal = settings.paperSize === 'thermal58' || settings.paperSize === 'thermal80';
  const effectiveMargins = isThermal ? 3 : settings.margins;

  // Paper dimensions for CSS
  const paperDef = PAPER_DEFS[settings.paperSize];
  const paperWidthPx = paperDef.widthMm * 3.78;

  const scale = getPreviewScale(paperDef.widthMm, containerWidth);

  // Build quotation/invoice data for renderer
  const renderQuotation: Quotation = {
    ...quotation,
    customer,
    products,
  };

  // For payment_receipt profile, we render a custom layout instead of DocumentRenderer
  const isPaymentReceipt = settings.profile === 'payment_receipt';

  // For delivery_challan and packing_slip, filter products to hide price columns
  const isDeliveryChallan = settings.profile === 'delivery_challan';
  const isPackingSlip = settings.profile === 'packing_slip';

  // Effective theme ID
  const effectiveThemeId = isThermal ? 'pos_compact' : paperToThemeId(settings.paperSize);

  // ── Print handler ──────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    // Build the print container
    const printContainer = document.createElement('div');
    printContainer.id = 'print-center-print-area';
    printContainer.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${paperWidthPx}px;
      background: #fff;
    `;

    // Clone the preview content into the print container
    const previewContent = previewRef.current?.querySelector('.print-preview-document');
    if (previewContent) {
      const clone = previewContent.cloneNode(true) as HTMLElement;
      // Remove the scale transform for actual printing
      clone.style.transform = '';
      clone.style.width = `${paperWidthPx}px`;
      clone.style.margin = '0 auto';
      printContainer.appendChild(clone);
    }

    document.body.appendChild(printContainer);

    // Add print-specific styles
    const styleEl = document.createElement('style');
    styleEl.id = 'print-center-style';
    styleEl.textContent = `
      @page {
        size: ${paperDef.widthMm}mm ${isThermal ? 'auto' : paperDef.heightMm + 'mm'};
        margin: ${effectiveMargins}mm;
      }
      @media print {
        body * { visibility: hidden !important; }
        #print-center-print-area, #print-center-print-area * { visibility: visible !important; }
        #print-center-print-area {
          position: static !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
        }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(styleEl);

    const cleanup = () => {
      document.body.removeChild(printContainer);
      document.head.removeChild(styleEl);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    // Trigger print
    setTimeout(() => {
      window.print();
      // Fallback cleanup if afterprint doesn't fire
      setTimeout(cleanup, 1000);
    }, 100);
  }, [paperWidthPx, paperDef, isThermal, effectiveMargins]);

  // ── Escape handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [open, onClose]);

  if (!open) return null;

  const currentProfile = PROFILE_DEFS.find(p => p.id === settings.profile)!;
  const ProfileIcon = currentProfile.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <Printer className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Enterprise Print Center</h2>
            <p className="text-xs text-slate-400">
              {docType === 'invoice' ? 'Invoice' : 'Quotation'} · {quotation.quotationNumber || invoice?.invoiceNumber}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body: left panel + right preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDE — Layout Selection */}
        <div className="w-80 lg:w-96 shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Paper Size Section */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Paper Size
              </h3>
              <div className="space-y-2">
                {PAPER_ORDER.map(paperKey => {
                  const def = PAPER_DEFS[paperKey];
                  const isSelected = settings.paperSize === paperKey;
                  const wMm = def.widthMm;
                  const hMm = def.heightMm || 200;
                  const previewW = Math.min(48, (wMm / Math.max(wMm, hMm)) * 48);
                  const previewH = Math.min(60, (hMm / Math.max(wMm, hMm)) * 60);
                  return (
                    <button
                      key={paperKey}
                      onClick={() => update({ paperSize: paperKey })}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Mini preview */}
                      <div className="shrink-0 flex items-center justify-center w-14 h-16">
                        <div
                          className={`border-2 rounded-sm ${
                            isSelected ? 'border-blue-500 bg-blue-100' : 'border-slate-400 bg-slate-100'
                          }`}
                          style={{ width: `${previewW}px`, height: `${previewH}px` }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                          {def.label}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {def.widthMm}mm
                          {def.heightMm > 0 ? ` × ${def.heightMm}mm` : ' (auto height)'}
                          {' · '}
                          {def.orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">{def.recommended}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print Profile Section */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <ProfileIcon className="w-4 h-4" />
                Print Profile
              </h3>
              <div className="space-y-2">
                {PROFILE_DEFS.map(profile => {
                  const Icon = profile.icon;
                  const isSelected = settings.profile === profile.id;
                  const isCompatible = !profile.compatibleSizes || profile.compatibleSizes.length === 0 || profile.compatibleSizes.includes(settings.paperSize);
                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileChange(profile.id)}
                      disabled={!isCompatible}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : isCompatible
                            ? 'border-slate-200 bg-white hover:border-slate-300'
                            : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                          {profile.label}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-snug">{profile.description}</div>
                        {!isCompatible && (
                          <div className="text-xs text-amber-600 mt-1 font-medium">
                            Use thermal paper size for this profile
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Print Options */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">Print Options</h3>
              <div className="space-y-3 bg-white rounded-lg border border-slate-200 p-4">
                {/* Orientation */}
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Orientation</label>
                  <div className="flex gap-2">
                    {(['portrait', 'landscape'] as PrintOrientation[]).map(o => (
                      <button
                        key={o}
                        onClick={() => update({ orientation: o })}
                        className={`flex-1 px-3 py-2 rounded-md text-xs font-medium border-2 transition-all capitalize ${
                          settings.orientation === o
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Margins */}
                {!isThermal && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      Margins: {settings.margins}mm
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      value={settings.margins}
                      onChange={e => update({ margins: parseInt(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}

                {/* Thermal width info */}
                {isThermal && (
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-md p-2">
                    Thermal mode: margins set to 3mm, auto height, compact spacing.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — Live Preview */}
        <div className="flex-1 bg-slate-200 overflow-y-auto p-4" ref={previewRef}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Live Preview</span>
              <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-300 rounded-full">
                {currentProfile.label} · {paperDef.label}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {Math.round(scale * 100)}% scale
            </span>
          </div>

          {/* Paper container */}
          <div className="flex justify-center">
            <div
              style={{
                width: `${paperWidthPx * scale}px`,
                minHeight: isThermal ? 'auto' : `${(paperDef.heightMm * 3.78) * scale}px`,
                background: '#fff',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                className="print-preview-document"
                style={{
                  width: `${paperWidthPx}px`,
                  margin: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  padding: `${effectiveMargins * 3.78}px`,
                  background: '#fff',
                  minHeight: isThermal ? 'auto' : `${paperDef.heightMm * 3.78}px`,
                }}
              >
                {isPaymentReceipt ? (
                  <PaymentReceiptLayout
                    company={company}
                    customer={customer}
                    quotation={renderQuotation}
                    invoice={invoice}
                    docType={docType}
                    paymentData={paymentReceiptData}
                    templateSettings={effectiveSettings}
                    isThermal={isThermal}
                  />
                ) : isDeliveryChallan ? (
                  <DeliveryChallanLayout
                    company={company}
                    customer={customer}
                    quotation={renderQuotation}
                    products={products}
                    templateSettings={effectiveSettings}
                    isThermal={isThermal}
                    schema={schema}
                  />
                ) : isPackingSlip ? (
                  <PackingSlipLayout
                    company={company}
                    customer={customer}
                    quotation={renderQuotation}
                    products={products}
                    templateSettings={effectiveSettings}
                    isThermal={isThermal}
                    schema={schema}
                  />
                ) : (
                  <DocumentRenderer
                    themeId={effectiveThemeId}
                    settings={effectiveSettings}
                    company={company}
                    customer={customer}
                    quotation={renderQuotation}
                    products={products}
                    docType={docType}
                    invoice={invoice}
                    customBlocks={customBlocks}
                    schema={schema}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM — Action Bar */}
      <div className="shrink-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>
            <Printer className="w-4 h-4 inline mr-1.5" />
            Ready to print
          </span>
          <span className="text-slate-600">·</span>
          <span>{paperDef.label}</span>
          <span className="text-slate-600">·</span>
          <span>{currentProfile.label}</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold flex items-center gap-2 shadow-lg"
          >
            <Printer className="w-4 h-4" />
            Print Document
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Payment Receipt Layout ────────────────────────────────────────────────────
function PaymentReceiptLayout({
  company, customer, quotation, invoice, docType, paymentData, isThermal,
}: {
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  invoice?: Invoice;
  docType: 'quotation' | 'invoice';
  paymentData?: PaymentReceiptData;
  templateSettings: TemplateSettings;
  isThermal: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const docNumber = docType === 'invoice' ? invoice?.invoiceNumber ?? '' : quotation.quotationNumber;
  const docDate = docType === 'invoice' ? invoice?.date ?? quotation.date : quotation.date;
  const grandTotal = docType === 'invoice' ? invoice?.grandTotal ?? quotation.grandTotal : quotation.grandTotal;
  const amountPaid = docType === 'invoice' ? invoice?.amountPaid ?? 0 : 0;
  const outstanding = Math.max(0, grandTotal - amountPaid);

  const receiptNo = paymentData?.receiptNumber || `RCP-${Date.now().toString().slice(-6)}`;
  const amountReceived = paymentData?.amountReceived ?? amountPaid;
  const paymentMode = paymentData?.paymentMode ?? 'Cash';
  const referenceNo = paymentData?.referenceNumber ?? '—';
  const paymentDate = paymentData?.paymentDate ?? new Date().toISOString().split('T')[0];
  const outstandingBalance = paymentData?.outstandingBalance ?? outstanding;

  const fontSize = isThermal ? '11px' : '14px';
  const labelSize = isThermal ? '9px' : '11px';
  const titleSize = isThermal ? '16px' : '22px';

  return (
    <div style={{ fontFamily: "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#000', fontSize }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
        {company.logo && (
          <img src={company.logo} alt="Logo" style={{ height: '40px', objectFit: 'contain', marginBottom: '8px' }} />
        )}
        <div style={{ fontSize: titleSize, fontWeight: 700 }}>{company.companyName || 'Company Name'}</div>
        {company.address && <div style={{ fontSize: labelSize, marginTop: '2px' }}>{company.address}</div>}
        {company.gstNumber && <div style={{ fontSize: labelSize, marginTop: '2px' }}>GSTIN: {company.gstNumber}</div>}
        {company.phone && <div style={{ fontSize: labelSize, marginTop: '2px' }}>{company.phone}</div>}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: '1px' }}>PAYMENT RECEIPT</div>
      </div>

      {/* Receipt details */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <ReceiptRow label="Receipt No." value={receiptNo} fontSize={fontSize} labelSize={labelSize} />
          <ReceiptRow label="Receipt Date" value={paymentDate} fontSize={fontSize} labelSize={labelSize} />
          <ReceiptRow label="Invoice Reference" value={docNumber} fontSize={fontSize} labelSize={labelSize} />
          <ReceiptRow label="Invoice Date" value={docDate} fontSize={fontSize} labelSize={labelSize} />
          <ReceiptRow label="Customer Name" value={customer.name} fontSize={fontSize} labelSize={labelSize} />
          {customer.mobile && <ReceiptRow label="Customer Mobile" value={customer.mobile} fontSize={fontSize} labelSize={labelSize} />}
          <ReceiptRow label="Payment Mode" value={paymentMode} fontSize={fontSize} labelSize={labelSize} />
          <ReceiptRow label="Reference Number" value={referenceNo} fontSize={fontSize} labelSize={labelSize} />
          <ReceiptRow label="Amount Received" value={`Rs. ${fmt(amountReceived)}`} fontSize={fontSize} labelSize={labelSize} bold />
          <ReceiptRow label="Outstanding Balance" value={`Rs. ${fmt(outstandingBalance)}`} fontSize={fontSize} labelSize={labelSize} bold />
        </tbody>
      </table>

      {/* Signature */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          {company.signature ? (
            <img src={company.signature} alt="Signature" style={{ height: '40px', objectFit: 'contain' }} />
          ) : (
            <div style={{ height: '40px' }} />
          )}
          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: labelSize }}>Authorised Signatory</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: labelSize, color: '#999' }}>
        Computer-generated receipt. No signature required.
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, fontSize, labelSize, bold }: { label: string; value: string; fontSize: string; labelSize: string; bold?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: '6px 0', fontSize: labelSize, color: '#666', width: '40%' }}>{label}</td>
      <td style={{ padding: '6px 0', fontSize, fontWeight: bold ? 700 : 400 }}>{value}</td>
    </tr>
  );
}

// ── Delivery Challan Layout ────────────────────────────────────────────────────
function DeliveryChallanLayout({
  company, customer, quotation, products, isThermal,
}: {
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  templateSettings: TemplateSettings;
  isThermal: boolean;
  schema?: TemplateSchema;
}) {
  const fontSize = isThermal ? '10px' : '13px';
  const titleSize = isThermal ? '16px' : '22px';
  const cellPad = isThermal ? '3px 4px' : '6px 8px';

  return (
    <div style={{ fontFamily: "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#000', fontSize }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
        {company.logo && (
          <img src={company.logo} alt="Logo" style={{ height: '40px', objectFit: 'contain', marginBottom: '8px' }} />
        )}
        <div style={{ fontSize: titleSize, fontWeight: 700 }}>{company.companyName || 'Company Name'}</div>
        {company.address && <div style={{ fontSize: isThermal ? '9px' : '11px', marginTop: '2px' }}>{company.address}</div>}
        {company.gstNumber && <div style={{ fontSize: isThermal ? '9px' : '11px', marginTop: '2px' }}>GSTIN: {company.gstNumber}</div>}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: '1px' }}>DELIVERY CHALLAN</div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: isThermal ? '9px' : '11px' }}>
        <div>
          <div><strong>Challan No:</strong> {quotation.quotationNumber}</div>
          <div><strong>Date:</strong> {quotation.date}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Customer:</strong> {customer.name}</div>
          {customer.billingAddress && <div>{customer.billingAddress}</div>}
          {customer.mobile && <div>Mobile: {customer.mobile}</div>}
        </div>
      </div>

      {/* Delivery details */}
      {quotation.shipTo?.name && (
        <div style={{ marginBottom: '12px', padding: '8px', border: '1px solid #ddd', fontSize: isThermal ? '9px' : '11px' }}>
          <strong>Delivery To:</strong> {quotation.shipTo.name}
          {quotation.shipTo.address && <>, {quotation.shipTo.address}</>}
        </div>
      )}

      {/* Product table — only name, qty, unit, description */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #000' }}>
            <th style={{ padding: cellPad, textAlign: 'center', fontWeight: 700 }}>No</th>
            <th style={{ padding: cellPad, textAlign: 'left', fontWeight: 700 }}>Item</th>
            <th style={{ padding: cellPad, textAlign: 'right', fontWeight: 700 }}>Qty</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: cellPad, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ padding: cellPad, textAlign: 'left' }}>
                {p.name}
                {p.description?.trim() && <div style={{ fontSize: isThermal ? '8px' : '10px', color: '#666', marginTop: '2px' }}>{p.description}</div>}
              </td>
              <td style={{ padding: cellPad, textAlign: 'right' }}>{p.quantity} {p.unit || 'pcs'}</td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>No items</td></tr>
          )}
        </tbody>
      </table>

      {/* Receiver details */}
      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', fontSize: isThermal ? '9px' : '11px' }}>
        <div>
          <strong>Received By:</strong>
          <div style={{ marginTop: '24px', borderTop: '1px solid #000', paddingTop: '4px', minWidth: '120px' }}>Signature</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>For {company.companyName || 'Company'}:</strong>
          <div style={{ marginTop: '24px', borderTop: '1px solid #000', paddingTop: '4px', minWidth: '120px' }}>Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

// ── Packing Slip Layout ────────────────────────────────────────────────────────
function PackingSlipLayout({
  company, customer, quotation, products, isThermal,
}: {
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  templateSettings: TemplateSettings;
  isThermal: boolean;
  schema?: TemplateSchema;
}) {
  const fontSize = isThermal ? '10px' : '13px';
  const titleSize = isThermal ? '16px' : '22px';
  const cellPad = isThermal ? '3px 4px' : '6px 8px';

  return (
    <div style={{ fontFamily: "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif", color: '#000', fontSize }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
        {company.logo && (
          <img src={company.logo} alt="Logo" style={{ height: '40px', objectFit: 'contain', marginBottom: '8px' }} />
        )}
        <div style={{ fontSize: titleSize, fontWeight: 700 }}>{company.companyName || 'Company Name'}</div>
        {company.address && <div style={{ fontSize: isThermal ? '9px' : '11px', marginTop: '2px' }}>{company.address}</div>}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: titleSize, fontWeight: 700, letterSpacing: '1px' }}>PACKING SLIP</div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: isThermal ? '9px' : '11px' }}>
        <div>
          <div><strong>Slip No:</strong> {quotation.quotationNumber}</div>
          <div><strong>Date:</strong> {quotation.date}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Customer:</strong> {customer.name}</div>
          {customer.billingAddress && <div>{customer.billingAddress}</div>}
        </div>
      </div>

      {/* Product table — name, qty, unit, description */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #000' }}>
            <th style={{ padding: cellPad, textAlign: 'center', fontWeight: 700 }}>No</th>
            <th style={{ padding: cellPad, textAlign: 'left', fontWeight: 700 }}>Item</th>
            <th style={{ padding: cellPad, textAlign: 'right', fontWeight: 700 }}>Qty</th>
            <th style={{ padding: cellPad, textAlign: 'right', fontWeight: 700 }}>Unit</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: cellPad, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ padding: cellPad, textAlign: 'left' }}>
                {p.name}
                {p.description?.trim() && <div style={{ fontSize: isThermal ? '8px' : '10px', color: '#666', marginTop: '2px' }}>{p.description}</div>}
              </td>
              <td style={{ padding: cellPad, textAlign: 'right' }}>{p.quantity}</td>
              <td style={{ padding: cellPad, textAlign: 'right' }}>{p.unit || 'pcs'}</td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>No items</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', fontSize: isThermal ? '9px' : '11px' }}>
        <div>
          <strong>Packed By:</strong>
          <div style={{ marginTop: '24px', borderTop: '1px solid #000', paddingTop: '4px', minWidth: '120px' }}>Signature</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>For {company.companyName || 'Company'}:</strong>
          <div style={{ marginTop: '24px', borderTop: '1px solid #000', paddingTop: '4px', minWidth: '120px' }}>Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}
