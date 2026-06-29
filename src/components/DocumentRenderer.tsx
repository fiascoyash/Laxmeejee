/**
 * DocumentRenderer – myBillBook-style flow-based document engine.
 *
 * Rules:
 *  - NO absolute/fixed positioning. Sections stack vertically via normal flow.
 *  - Product table height = rows × rowHeight. No fixed height ever.
 *  - Toggle a section OFF → it vanishes completely, page reflows automatically.
 *  - Every theme is applied via inline styles; layout never changes between themes.
 *  - Identical markup is used for both preview and PDF capture (WYSIWYG).
 *  - Custom blocks can be inserted into predefined dynamic zones.
 *  - Every text element is controllable via typography system (element-level or global).
 */

import React from 'react';
import {
  CompanyProfile, Customer, Quotation, Product,
  TemplateSettings, Invoice, InvoiceTheme, INVOICE_THEMES, ThemeId,
  TemplateBlock, BlockZone, TypographyElementId, DEFAULT_TYPOGRAPHY_VALUES,
  TemplateSchema, TableColumn,
} from '../types';
import {
  calculateProductAmount, calculateTaxSummary,
  calculateRoundOff, numberToWords, roundTo2, calculateGrandTotalAmount,
} from '../utils/storage';

export type DocType = 'quotation' | 'invoice';

interface Props {
  themeId: ThemeId;
  settings: TemplateSettings;
  company: CompanyProfile;
  customer: Customer;
  quotation: Quotation;
  products: Product[];
  docType?: DocType;
  invoice?: Invoice;
  /** Custom blocks to render in dynamic zones */
  customBlocks?: TemplateBlock[];
  /** When true, renders at 100% for PDF capture. Otherwise scales to preview container. */
  forPdf?: boolean;
  /** Called when a zone is clicked (for builder mode) */
  onZoneClick?: (zone: BlockZone) => void;
  /** Called when a block is clicked (for builder mode) */
  onBlockClick?: (blockId: string) => void;
  /** ID of currently selected block (for builder mode) */
  selectedBlockId?: string;
  /** Whether to show zone drop indicators */
  showZones?: boolean;
  /** Called when a typography element is clicked (for typography editing) */
  onTypographyElementClick?: (elementId: TypographyElementId) => void;
  /** ID of currently selected typography element */
  selectedTypographyElementId?: TypographyElementId;
  /** Template schema - defines industry-specific columns (SINGLE SOURCE OF TRUTH) */
  schema?: TemplateSchema;
}

const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Corner decorations (Luxury theme only) ──────────────────────────────────
function CornerDecos({ color }: { color: string }) {
  const s: React.CSSProperties = {
    position: 'absolute',
    fontSize: '18px',
    color,
    lineHeight: 1,
    zIndex: 2,
    userSelect: 'none',
  };
  return (
    <>
      <span style={{ ...s, top: 5, left: 8 }}>❧</span>
      <span style={{ ...s, top: 5, right: 8, transform: 'scaleX(-1)' }}>❧</span>
    </>
  );
}

// ─── Watermark ────────────────────────────────────────────────────────────────
function Watermark({ text }: { text: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: '72px',
          fontWeight: 900,
          color: 'rgba(0,0,0,0.04)',
          transform: 'rotate(-30deg)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DocumentRenderer({
  themeId,
  settings,
  company,
  customer,
  quotation,
  products,
  docType = 'quotation',
  invoice,
  customBlocks = [],
  onZoneClick,
  onBlockClick,
  selectedBlockId,
  showZones = false,
  onTypographyElementClick,
  selectedTypographyElementId,
  schema,
}: Props) {
  const theme: InvoiceTheme = INVOICE_THEMES[themeId] ?? INVOICE_THEMES.simple;
  const gstMode = quotation.gstMode ?? 'inclusive';

  // SINGLE SOURCE OF TRUTH: Check if a column should be visible
  // Priority: 1) Schema columns, 2) Settings flags
  const isColumnVisible = (columnKey: string): boolean => {
    // Priority 1: Check schema columns if available
    if (schema?.productColumns) {
      const schemaCol = schema.productColumns.find(c => c.key === columnKey);
      if (schemaCol) {
        return schemaCol.visible !== false; // default to true if not specified
      }
    }
    // Priority 2: Fall back to settings flags
    const settingsMap: Record<string, boolean> = {
      hsnCode: settings.showTax,
      sacCode: settings.showTax,
      batchNumber: settings.showBatchNumber,
      expiryDate: settings.showExpiryDate,
      mrp: false, // MRP only via schema
      quantity: settings.showQuantity,
      unit: settings.showUnit,
      discount: settings.showDiscount,
      gstPercent: settings.showTax,
      description: settings.showDescription,
      wattage: false, // Wattage only via schema
      partNumber: false, // Part number only via schema
      vehicleModel: false, // Vehicle model only via schema
      warrantyMonths: false, // Warranty only via schema
    };
    return settingsMap[columnKey] ?? false;
  };

  // Global default font size
  const globalDefaultFontSize = settings.globalDefaultFontSize ?? 12;

  // Helper function to get typography style for an element
  // Priority: 1) Element override (usesGlobal=false), 2) Global default, 3) DEFAULT_TYPOGRAPHY_VALUES
  const getTypographyStyle = (
    elementId: TypographyElementId,
    fallback: { fontSize: number; fontWeight: number; color: string }
  ): React.CSSProperties => {
    const override = settings.typographyOverrides?.[elementId];
    const defaults = DEFAULT_TYPOGRAPHY_VALUES[elementId] || fallback;

    // If element has custom override (usesGlobal=false), use that
    // Otherwise use global default for fontSize, defaults for fontWeight/color
    const fontSize = override?.usesGlobal === false
      ? (override.fontSize ?? defaults.fontSize)
      : globalDefaultFontSize;

    const fontWeight = override?.usesGlobal === false
      ? (override.fontWeight ?? defaults.fontWeight)
      : defaults.fontWeight;

    const color = override?.usesGlobal === false
      ? (override.color ?? defaults.color)
      : defaults.color;

    return {
      fontSize: `${fontSize}px`,
      fontWeight,
      color,
    };
  };

  // Typography colors (user-customizable via Template Settings → Typography)
  // Note: These are kept for theme-specific styling, element-level control uses getTypographyStyle
  const bodyTextColor = settings.bodyTextColor ?? '#000000';
  const tableHeaderTextColor = settings.tableHeaderTextColor ?? '#000000';
  const totalSectionColor = settings.totalSectionColor ?? '#000000';
  // Typography font weights (for grand total styling)
  const grandTotalFontWeight = settings.grandTotalFontWeight ?? 700;

  // Helper component for clickable typography elements
  const T = ({
    id,
    children,
    style,
    as: Component = 'span',
  }: {
    id: TypographyElementId;
    children: React.ReactNode;
    style?: React.CSSProperties;
    as?: 'span' | 'div' | 'td' | 'th';
  }) => {
    const isSelected = selectedTypographyElementId === id;
    const handleClick = onTypographyElementClick
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onTypographyElementClick(id);
        }
      : undefined;

    const typographyStyle = getTypographyStyle(id, { fontSize: 12, fontWeight: 400, color: '#000000' });

    const elementStyle: React.CSSProperties = {
      ...typographyStyle,
      ...style,
      cursor: onTypographyElementClick ? 'pointer' : undefined,
      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : style?.backgroundColor,
      outline: isSelected ? '2px dashed #3B82F6' : undefined,
      outlineOffset: '2px',
    };

    return (
      <Component
        style={elementStyle}
        onClick={handleClick}
        data-typography-id={id}
      >
        {children}
      </Component>
    );
  };

  const taxSummary = calculateTaxSummary(products, gstMode);
  const totalTaxable = roundTo2(
    Array.from(taxSummary.values()).reduce((s, t) => s + t.taxableAmount, 0),
  );
  const totalCgst = roundTo2(
    Array.from(taxSummary.values()).reduce((s, t) => s + t.cgstAmount, 0),
  );
  const totalSgst = roundTo2(
    Array.from(taxSummary.values()).reduce((s, t) => s + t.sgstAmount, 0),
  );
  const grandTotalRaw = calculateGrandTotalAmount(products, gstMode);
  const { roundOff, roundedGrandTotal } = calculateRoundOff(grandTotalRaw);

  const docLabel = docType === 'invoice' ? 'TAX INVOICE' : 'QUOTATION';
  const docNumber =
    docType === 'invoice' ? invoice?.invoiceNumber ?? '' : quotation.quotationNumber;
  const docDate =
    docType === 'invoice' ? invoice?.date ?? quotation.date : quotation.date;
  const dueDate = docType === 'invoice' ? invoice?.dueDate : undefined;

  const hasShipTo =
    settings.showShippingAddress &&
    !!(quotation.shipTo?.name?.trim() || quotation.shipTo?.address?.trim());

  const outerStyle: React.CSSProperties = {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: `${globalDefaultFontSize}px`,
    color: bodyTextColor,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    width: '100%',
    ...(theme.outerBorder && {
      border: `${theme.outerBorderWidth}px solid ${theme.primaryColor}`,
    }),
  };

  const sec: React.CSSProperties = {
    borderBottom: `1px solid ${theme.sectionBorderColor}`,
    position: 'relative',
    zIndex: 1,
  };

  const secNoBorder: React.CSSProperties = { position: 'relative', zIndex: 1 };

  // ─── Get blocks for a specific zone ───────────────────────────────────────
  const getBlocksForZone = (zone: BlockZone): TemplateBlock[] => {
    return customBlocks
      .filter(b => b.zone === zone && b.visible)
      .sort((a, b) => a.order - b.order);
  };

  // ─── Render a custom block ────────────────────────────────────────────────
  const renderCustomBlock = (block: TemplateBlock): React.ReactNode => {
    const isSelected = selectedBlockId === block.id;
    const blockStyle: React.CSSProperties = {
      padding: '8px 16px',
      borderBottom: `1px solid ${theme.sectionBorderColor}`,
      backgroundColor: isSelected ? '#FEF3C7' : 'transparent',
      cursor: onBlockClick ? 'pointer' : 'default',
      position: 'relative',
      zIndex: 1,
    };

    const content = (() => {
      switch (block.type) {
        case 'bank_details':
          return (
            <>
              <T id="bank_details_label" style={{ color: theme.primaryColor, marginBottom: '4px' }}>
                Bank Details
              </T>
              {company.bankName && <T id="bank_details_content" as="div">Bank: <strong>{company.bankName}</strong></T>}
              {company.bankAccount && <T id="bank_details_content" as="div">A/c: <strong>{company.bankAccount}</strong></T>}
              {company.bankIfsc && <T id="bank_details_content" as="div">IFSC: <strong>{company.bankIfsc}</strong></T>}
              {company.bankBranch && <T id="bank_details_content" as="div">Branch: {company.bankBranch}</T>}
            </>
          );

        case 'signature_box':
          return (
            <div style={{ textAlign: 'center', minWidth: '130px' }}>
              {company.signature ? (
                <img src={company.signature} alt="Signature" style={{ height: '45px', objectFit: 'contain', marginBottom: '4px' }} />
              ) : (
                <div style={{ height: '45px' }} />
              )}
              <T id="signature_label" style={{ borderTop: `1px solid ${theme.sectionBorderColor}`, paddingTop: '4px' }}>
                Authorised Signatory
              </T>
            </div>
          );

        case 'terms_conditions':
          return (
            <>
              <T id="terms_label" style={{ color: theme.primaryColor, marginBottom: '3px' }}>
                Terms &amp; Conditions
              </T>
              <T id="terms_content" as="div" style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {block.content || '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.'}
              </T>
            </>
          );

        case 'footer_notes':
          return (
            <T id="custom_block" as="div" style={{ textAlign: 'center', whiteSpace: 'pre-wrap' }}>
              {block.content || 'Thank you for your business!'}
            </T>
          );

        case 'warranty':
          return (
            <>
              <T id="terms_label" style={{ color: theme.primaryColor, marginBottom: '3px' }}>
                Warranty
              </T>
              <T id="terms_content" as="div" style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {block.content || 'Product warranty: 12 months from date of purchase.\nWarranty covers manufacturing defects only.'}
              </T>
            </>
          );

        case 'transport_details':
          return (
            <>
              <T id="terms_label" style={{ color: theme.primaryColor, marginBottom: '3px' }}>
                Transport Details
              </T>
              <T id="terms_content" as="div" style={{ lineHeight: 1.5 }}>
                {block.content || 'Transport: To be arranged by buyer'}
              </T>
            </>
          );

        case 'delivery_details':
          return (
            <>
              <T id="terms_label" style={{ color: theme.primaryColor, marginBottom: '3px' }}>
                Delivery Details
              </T>
              <T id="terms_content" as="div" style={{ lineHeight: 1.5 }}>
                {block.content || 'Delivery: Within 7-10 working days\nDelivery charges extra as applicable'}
              </T>
            </>
          );

        case 'installation_details':
          return (
            <>
              <T id="terms_label" style={{ color: theme.primaryColor, marginBottom: '3px' }}>
                Installation Details
              </T>
              <T id="terms_content" as="div" style={{ lineHeight: 1.5 }}>
                {block.content || 'Installation: To be done by our certified technician\nInstallation charges included in the quote'}
              </T>
            </>
          );

        case 'divider':
          return (
            <div style={{ width: '100%', height: '1px', backgroundColor: block.style?.color || theme.sectionBorderColor, margin: '4px 0' }} />
          );

        case 'text_block':
        default:
          return (
            <T id="custom_block" as="div" style={{ whiteSpace: 'pre-wrap' }}>
              {block.content || 'Custom content'}
            </T>
          );
      }
    })();

    const handleClick = onBlockClick ? () => onBlockClick(block.id) : undefined;

    return (
      <div
        key={block.id}
        style={blockStyle}
        onClick={handleClick}
      >
        {content}
      </div>
    );
  };

  // ─── Zone Drop Indicator ──────────────────────────────────────────────────
  const ZoneIndicator = ({ zone, direction = 'horizontal' }: { zone: BlockZone; direction?: 'horizontal' | 'vertical' }) => {
    if (!showZones) return null;

    const zoneLabels: Record<BlockZone, string> = {
      after_header: 'After Header',
      after_meta: 'After Invoice Details',
      after_party: 'After Party Details',
      after_products: 'After Products',
      after_totals: 'After Totals',
      after_bank: 'After Bank Details',
      footer: 'At Footer',
      party_left: 'Bill To Area',
      party_right: 'Ship To Area',
      bank_left: 'Left Bank Area',
      bank_right: 'Right Bank Area',
      footer_left: 'Footer Left',
      footer_center: 'Footer Center',
      footer_right: 'Footer Right',
      canvas: 'Canvas',
    };

    const baseStyle: React.CSSProperties = {
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      color: '#3B82F6',
      fontWeight: 500,
      backgroundColor: '#EFF6FF',
    };

    if (direction === 'vertical') {
      return (
        <div
          onClick={() => onZoneClick?.(zone)}
          style={{
            ...baseStyle,
            flexDirection: 'column',
            padding: '8px 4px',
            borderRight: `1px dashed #93C5FD`,
            minWidth: '60px',
            flex: 1,
          }}
        >
          <span style={{ writingMode: 'horizontal-tb', textAlign: 'center' }}>+ {zoneLabels[zone]}</span>
        </div>
      );
    }

    return (
      <div
        onClick={() => onZoneClick?.(zone)}
        style={{
          ...baseStyle,
          padding: '10px 16px',
          borderBottom: '1px dashed #93C5FD',
          gap: '6px',
        }}
      >
        <span>+ Add Block: {zoneLabels[zone]}</span>
      </div>
    );
  };

  // ─── Split Zone Container (for side-by-side zones) ───────────────────────────
  const SplitZoneIndicators = ({ leftZone, rightZone }: { leftZone: BlockZone; rightZone: BlockZone }) => {
    if (!showZones) return null;
    return (
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${theme.sectionBorderColor}`,
        }}
      >
        <div style={{ flex: 1, borderRight: `1px dashed #93C5FD` }}>
          <ZoneIndicator zone={leftZone} direction="vertical" />
        </div>
        <div style={{ flex: 1 }}>
          <ZoneIndicator zone={rightZone} direction="vertical" />
        </div>
      </div>
    );
  };

  // ─── Render blocks for a specific zone ─────────────────────────────────────
  const RenderZoneBlocks = (zone: BlockZone) => {
    const zoneBlocks = getBlocksForZone(zone);
    return (
      <>
        {zoneBlocks.map(block => renderCustomBlock(block))}
      </>
    );
  };

  // ── SECTION 1: Company Header ─────────────────────────────────────────────
  const headerAlign = settings.headerAlignment ?? 'left';

  const CompanyInfoBlock = ({ align }: { align: 'left' | 'center' | 'right' }) => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1, flexDirection: align === 'center' ? 'column' : 'row', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {company.logo && (
        <img
          src={company.logo}
          alt="Logo"
          style={{ width: '52px', height: '42px', objectFit: 'contain', flexShrink: 0, alignSelf: align === 'center' ? 'center' : 'flex-start' }}
        />
      )}
      <div style={{ textAlign: align }}>
        <T
          id="company_name"
          style={{
            lineHeight: 1.15,
            letterSpacing: '-0.2px',
          }}
        >
          {company.companyName || 'Company Name'}
        </T>
        {company.address && (
          <T id="company_address" as="div" style={{ marginTop: '3px' }}>
            {company.address}
          </T>
        )}
        {settings.showGstin && company.gstNumber && (
          <div style={{ marginTop: '3px' }}>
            <T id="company_gstin">
              GSTIN&nbsp;<strong style={{ letterSpacing: '0.3px' }}>{company.gstNumber}</strong>
            </T>
          </div>
        )}
        {settings.showPhone && company.phone && (
          <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
            <span>📞</span> <T id="company_phone">{company.phone}</T>
            {company.email && (
              <><span style={{ margin: '0 4px' }}>✉</span><T id="company_email">{company.email}</T></>
            )}
          </div>
        )}
        {!settings.showPhone && company.email && (
          <div style={{ marginTop: '2px' }}>✉ <T id="company_email">{company.email}</T></div>
        )}
      </div>
    </div>
  );

  const DocTypeBlock = (
    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
      <T
        id="doc_title"
        style={{
          color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
          letterSpacing: '1px',
        }}
      >
        {docLabel}
      </T>
      <T
        id="original_for_recipient"
        as="div"
        style={{
          border: `1px solid ${themeId === 'stylish' ? '#FFFFFF99' : theme.primaryColor}`,
          padding: '1px 7px',
          marginTop: '3px',
          color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
          letterSpacing: '0.5px',
          display: 'inline-block',
        }}
      >
        ORIGINAL FOR RECIPIENT
      </T>
    </div>
  );

  const HeaderSection = (
    <div
      style={{
        ...sec,
        backgroundColor: theme.headerBg,
        color: theme.headerTextColor,
        padding: '14px 16px 12px',
      }}
    >
      {headerAlign === 'center' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'center' }}>
            <T
              id="doc_title"
              style={{
                color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
                letterSpacing: '1px',
                marginBottom: '6px',
              }}
            >
              {docLabel}
            </T>
            <CompanyInfoBlock align="center" />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <T
              id="original_for_recipient"
              style={{
                border: `1px solid ${themeId === 'stylish' ? '#FFFFFF99' : theme.primaryColor}`,
                padding: '1px 7px',
                color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
                letterSpacing: '0.5px',
                display: 'inline-block',
              }}
            >
              ORIGINAL FOR RECIPIENT
            </T>
          </div>
        </div>
      ) : headerAlign === 'right' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {DocTypeBlock}
          <CompanyInfoBlock align="right" />
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <CompanyInfoBlock align="left" />
          {DocTypeBlock}
        </div>
      )}

      {/* Accent bar for billbook theme */}
      {theme.accentBar && (
        <div
          style={{
            height: '3px',
            backgroundColor: theme.primaryColor,
            margin: '10px -16px -12px',
          }}
        />
      )}
    </div>
  );

  // ── SECTION 2: Invoice Meta ────────────────────────────────────────────────
  const MetaCell = ({ labelId, valueId, label, value, highlight = false }: {
    labelId: TypographyElementId;
    valueId: TypographyElementId;
    label: string;
    value: string;
    highlight?: boolean;
  }) => (
    <div>
      <T id={labelId} style={{ marginBottom: '2px' }}>{label}</T>
      <T id={valueId} style={{ color: highlight ? theme.primaryColor : 'inherit' }}>{value}</T>
    </div>
  );

  const MetaSection = (
    <div
      style={{
        ...sec,
        padding: '8px 16px',
        display: 'flex',
        gap: '28px',
        flexWrap: 'wrap',
        backgroundColor: '#FFFFFF',
      }}
    >
      <MetaCell
        labelId={docType === 'invoice' ? 'invoice_number_label' : 'quotation_number_label'}
        valueId={docType === 'invoice' ? 'invoice_number_value' : 'quotation_number_value'}
        label={docType === 'invoice' ? 'Invoice No.' : 'Quotation No.'}
        value={docNumber}
      />
      <MetaCell
        labelId={docType === 'invoice' ? 'invoice_date_label' : 'quotation_date_label'}
        valueId={docType === 'invoice' ? 'invoice_date_value' : 'quotation_date_value'}
        label={docType === 'invoice' ? 'Invoice Date' : 'Quotation Date'}
        value={docDate}
      />
      {settings.showDueDate && dueDate && (
        <MetaCell labelId="due_date_label" valueId="due_date_value" label="Due Date" value={dueDate} highlight />
      )}
      {settings.showDueDate && !dueDate && (
        <MetaCell labelId="due_date_label" valueId="due_date_value" label="Due Date" value="—" />
      )}
      {settings.showPoNumber && (
        <MetaCell labelId="po_number_label" valueId="po_number_value" label="PO Number" value="—" />
      )}
      {settings.showEwayBill && (
        <MetaCell labelId="eway_bill_label" valueId="eway_bill_value" label="E-Way Bill" value="—" />
      )}
      {settings.showVehicleNumber && (
        <MetaCell labelId="vehicle_number_label" valueId="vehicle_number_value" label="Vehicle No." value="—" />
      )}
    </div>
  );

  // ── SECTION 3: Bill To / Ship To ──────────────────────────────────────────
  const PartySection = (
    <div
      style={{
        ...sec,
        display: 'flex',
        minHeight: '60px',
      }}
    >
      {/* Bill To */}
      <div
        style={{
          flex: 1,
          padding: '10px 16px',
          borderRight: hasShipTo ? `1px solid ${theme.sectionBorderColor}` : 'none',
        }}
      >
        <T id="bill_to_label" style={{ color: theme.primaryColor, marginBottom: '4px' }}>
          Bill To
        </T>
        <T id="bill_to_name" as="div">{customer.name}</T>
        {settings.showBillingAddress && customer.billingAddress && (
          <T id="bill_to_address" as="div" style={{ marginTop: '2px' }}>
            {customer.billingAddress}
          </T>
        )}
        {(customer.village || customer.district) && (
          <T id="bill_to_address" as="div">
            {[customer.village, customer.district].filter(Boolean).join(', ')}
          </T>
        )}
        {settings.showPhone && customer.mobile && (
          <div style={{ marginTop: '2px' }}>
            Mobile <strong><T id="bill_to_phone">{customer.mobile}</T></strong>
          </div>
        )}
        {settings.showGstin && customer.gstNumber && (
          <div>
            GSTIN <strong><T id="bill_to_gstin">{customer.gstNumber}</T></strong>
          </div>
        )}
      </div>

      {/* Ship To */}
      {hasShipTo && (
        <div style={{ flex: 1, padding: '10px 16px' }}>
          <T id="ship_to_label" style={{ color: theme.primaryColor, marginBottom: '4px' }}>
            Ship To
          </T>
          {quotation.shipTo?.name && (
            <T id="ship_to_name" as="div">{quotation.shipTo.name}</T>
          )}
          {quotation.shipTo?.address && (
            <T id="ship_to_address" as="div" style={{ marginTop: '2px' }}>
              {quotation.shipTo.address}
            </T>
          )}
          {settings.showPhone && quotation.shipTo?.mobile && (
            <div style={{ marginTop: '2px' }}>
              Mobile <strong><T id="ship_to_phone">{quotation.shipTo.mobile}</T></strong>
            </div>
          )}
          {settings.showGstin && quotation.shipTo?.gstNumber && (
            <div>
              GSTIN <strong><T id="ship_to_gstin">{quotation.shipTo.gstNumber}</T></strong>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── SECTION 4: Product Table ──────────────────────────────────────────────
  const ProductTable = (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        position: 'relative',
        zIndex: 1,
        borderBottom: `1px solid ${theme.sectionBorderColor}`,
      }}
    >
      <thead>
        <tr
          style={{
            backgroundColor: theme.tableHeaderBg,
            color: tableHeaderTextColor,
            fontWeight: 600,
            borderBottom: `1.5px solid ${theme.tableBorderColor}`,
          }}
        >
          <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap', width: '32px' }}>
            <T id="table_header">No</T>
          </th>
          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>
            <T id="table_header">Items</T>
          </th>
          {isColumnVisible('hsnCode') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">HSN No.</T>
            </th>
          )}
          {isColumnVisible('sacCode') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">SAC</T>
            </th>
          )}
          {isColumnVisible('wattage') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">Wattage</T>
            </th>
          )}
          {isColumnVisible('partNumber') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">Part No.</T>
            </th>
          )}
          {isColumnVisible('vehicleModel') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '80px' }}>
              <T id="table_header">Vehicle</T>
            </th>
          )}
          {isColumnVisible('mrp') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">MRP</T>
            </th>
          )}
          {isColumnVisible('batchNumber') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">Batch No.</T>
            </th>
          )}
          {isColumnVisible('expiryDate') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '80px' }}>
              <T id="table_header">Expiry</T>
            </th>
          )}
          {isColumnVisible('warrantyMonths') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '72px' }}>
              <T id="table_header">Warranty</T>
            </th>
          )}
          {isColumnVisible('quantity') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '54px' }}>
              <T id="table_header">Qty.</T>
            </th>
          )}
          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '76px' }}>
            <T id="table_header">Rate</T>
          </th>
          {isColumnVisible('discount') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '70px' }}>
              <T id="table_header">Disc.</T>
            </th>
          )}
          {isColumnVisible('gstPercent') && (
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '76px' }}>
              <T id="table_header">Tax</T>
            </th>
          )}
          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', width: '84px' }}>
            <T id="table_header">Total</T>
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product, i) => {
          const amount = calculateProductAmount(product);
          const taxSummaryForProduct = calculateTaxSummary([product], gstMode);
          const productTaxEntry = Array.from(taxSummaryForProduct.values())[0];
          const taxAmount = productTaxEntry
            ? roundTo2(productTaxEntry.cgstAmount + productTaxEntry.sgstAmount)
            : 0;

          const rowBg = i % 2 === 1 ? theme.tableRowAltBg : '#FFFFFF';
          return (
            <tr
              key={product.id}
              style={{
                backgroundColor: rowBg,
                borderBottom: `1px solid ${theme.tableBorderColor}`,
              }}
            >
              <td style={{ padding: '6px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                <T id="product_row">{i + 1}</T>
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'left', verticalAlign: 'top' }}>
                <T id="product_row" as="div">{product.name}</T>
                {isColumnVisible('description') && product.description?.trim() && (
                  <T id="product_description" as="div" style={{ marginTop: '2px', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                    {product.description}
                  </T>
                )}
              </td>
              {isColumnVisible('hsnCode') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.hsnCode || '—'}</T>
                </td>
              )}
              {isColumnVisible('sacCode') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.sacCode || '—'}</T>
                </td>
              )}
              {isColumnVisible('wattage') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.wattage ? `${product.wattage}W` : '—'}</T>
                </td>
              )}
              {isColumnVisible('partNumber') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.partNumber || '—'}</T>
                </td>
              )}
              {isColumnVisible('vehicleModel') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.vehicleModel || '—'}</T>
                </td>
              )}
              {isColumnVisible('mrp') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.mrp ? `Rs. ${product.mrp.toLocaleString('en-IN')}` : '—'}</T>
                </td>
              )}
              {isColumnVisible('batchNumber') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.batchNumber || '—'}</T>
                </td>
              )}
              {isColumnVisible('expiryDate') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.expiryDate || '—'}</T>
                </td>
              )}
              {isColumnVisible('warrantyMonths') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.warrantyMonths ? `${product.warrantyMonths} mo` : '—'}</T>
                </td>
              )}
              {isColumnVisible('quantity') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top', color: theme.primaryColor }}>
                  <T id="product_row">{product.quantity}</T>
                  {isColumnVisible('unit') && (
                    <span style={{ marginLeft: '2px' }}>PCS</span>
                  )}
                </td>
              )}
              <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                <T id="product_row">{product.unitPrice.toLocaleString('en-IN')}</T>
              </td>
              {isColumnVisible('discount') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <T id="product_row">{product.discount ?? 0}%</T>
                </td>
              )}
              {isColumnVisible('gstPercent') && (
                <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                  <div><T id="product_row">{taxAmount.toLocaleString('en-IN')}</T></div>
                  <div style={{ fontSize: '9px' }}>({product.gstPercent}%)</div>
                </td>
              )}
              <td style={{ padding: '6px 8px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>
                <T id="product_row">{amount.toLocaleString('en-IN')}</T>
              </td>
            </tr>
          );
        })}
        {products.length === 0 && (
          <tr>
            <td
              colSpan={15}
              style={{
                textAlign: 'center',
                padding: '20px',
                color: '#aaa',
              }}
            >
              No items added
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  // ── SECTION 5: Tax Summary + Grand Total ─────────────────────────────────
  const showTaxSummary = settings.showTaxSummary !== false;
  const TotalsSection = (
    <div
      style={{
        ...sec,
        display: 'flex',
      }}
    >
      {/* HSN / Tax Summary */}
      {showTaxSummary && (
        <div
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRight: `1px solid ${theme.sectionBorderColor}`,
          }}
        >
          <T id="tax_summary_label" style={{ color: theme.primaryColor, marginBottom: '5px' }}>
            Tax Summary
          </T>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: theme.tableHeaderBg, color: tableHeaderTextColor }}>
                {['HSN', 'Tax%', 'Taxable Amt', 'CGST', 'SGST'].map(h => (
                  <th key={h} style={{ padding: '3px 5px', textAlign: h === 'HSN' ? 'left' : 'right', fontWeight: 600 }}>
                    <T id="tax_summary_row">{h}</T>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(taxSummary.entries()).map(([key, data]) => {
                const [hsn, rate] = key.split('_');
                return (
                  <tr key={key} style={{ borderTop: `1px solid ${theme.tableBorderColor}` }}>
                    <td style={{ padding: '2px 5px' }}><T id="tax_summary_row">{hsn}</T></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}><T id="tax_summary_row">{rate}%</T></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}><T id="tax_summary_row">{fmt(data.taxableAmount)}</T></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}><T id="tax_summary_row">{fmt(data.cgstAmount)}</T></td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}><T id="tax_summary_row">{fmt(data.sgstAmount)}</T></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grand Total */}
      <div style={{ width: showTaxSummary ? '220px' : '100%', padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <T id="subtotal_label" style={{ fontWeight: 600 }}>Sub Total</T>
          <T id="subtotal_value">₹{fmt(totalTaxable)}</T>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <T id="cgst_label" style={{ fontWeight: 600 }}>CGST</T>
          <T id="cgst_value">₹{fmt(totalCgst)}</T>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <T id="sgst_label" style={{ fontWeight: 600 }}>SGST</T>
          <T id="sgst_value">₹{fmt(totalSgst)}</T>
        </div>
        {roundOff !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <T id="round_off_label" style={{ fontWeight: 600 }}>Round Off</T>
            <T id="round_off_value">₹{fmt(roundOff)}</T>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: `1.5px solid ${theme.sectionBorderColor}`,
            paddingTop: '5px',
            marginTop: '5px',
          }}
        >
          <T id="grand_total_label" style={{ fontWeight: grandTotalFontWeight, color: totalSectionColor }}>Total</T>
          <T id="grand_total_value" style={{ fontWeight: grandTotalFontWeight, color: totalSectionColor }}>₹{fmt(roundedGrandTotal)}</T>
        </div>
        <T id="amount_in_words" as="div" style={{ marginTop: '4px', fontStyle: 'italic', lineHeight: 1.4 }}>
          {numberToWords(roundedGrandTotal)}
        </T>
      </div>
    </div>
  );

  // ── SECTION 6: Notes ──────────────────────────────────────────────────────
  const NotesSection = settings.showNotes ? (
    <div style={{ ...sec, padding: '8px 16px' }}>
      <T id="notes_label" style={{ color: theme.primaryColor }}>Notes: </T>
      <T id="notes_value">{quotation.notes || 'Thank you for your business!'}</T>
    </div>
  ) : null;

  // ── SECTION 7: Bank Details + QR + Signature ──────────────────────────────
  const hasFooter = settings.showBankDetails || settings.showPaymentQr || settings.showSignature;
  const FooterSection = hasFooter ? (
    <div
      style={{
        ...sec,
        display: 'flex',
        gap: '0',
        alignItems: 'stretch',
      }}
    >
      {settings.showBankDetails && (
        <div
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRight:
              settings.showPaymentQr || settings.showSignature
                ? `1px solid ${theme.sectionBorderColor}`
                : 'none',
          }}
        >
          <T id="bank_details_label" style={{ color: theme.primaryColor, marginBottom: '4px' }}>
            Bank Details
          </T>
          {company.bankName && (
            <div>
              Bank: <strong><T id="bank_details_content">{company.bankName}</T></strong>
            </div>
          )}
          {company.bankAccount && (
            <div>
              A/c: <strong><T id="bank_details_content">{company.bankAccount}</T></strong>
            </div>
          )}
          {company.bankIfsc && (
            <div>
              IFSC: <strong><T id="bank_details_content">{company.bankIfsc}</T></strong>
            </div>
          )}
          {company.bankBranch && (
            <div>
              Branch: <T id="bank_details_content">{company.bankBranch}</T>
            </div>
          )}
        </div>
      )}

      {settings.showPaymentQr && (
        <div
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: settings.showSignature
              ? `1px solid ${theme.sectionBorderColor}`
              : 'none',
          }}
        >
          {quotation.paymentQr ? (
            <img
              src={quotation.paymentQr}
              alt="Payment QR"
              style={{
                width: '64px',
                height: '64px',
                objectFit: 'contain',
                borderRadius: '2px',
              }}
            />
          ) : (
            <div
              style={{
                width: '64px',
                height: '64px',
                border: `1.5px solid ${theme.primaryColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '2px',
              }}
            >
              <T id="custom_block">QR Code</T>
            </div>
          )}
          <T id="custom_block" as="div" style={{ marginTop: '3px' }}>Scan to Pay</T>
        </div>
      )}

      {settings.showSignature && (
        <div
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            minWidth: '130px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {quotation.signature ? (
            <img
              src={quotation.signature}
              alt="Signature"
              style={{ height: '45px', objectFit: 'contain', marginBottom: '4px' }}
            />
          ) : company.signature ? (
            <img
              src={company.signature}
              alt="Signature"
              style={{ height: '45px', objectFit: 'contain', marginBottom: '4px' }}
            />
          ) : (
            <div style={{ height: '45px' }} />
          )}
          <div
            style={{
              borderTop: `1px solid ${theme.sectionBorderColor}`,
              paddingTop: '4px',
            }}
          >
            <T id="signature_label">Authorised Signatory</T>
          </div>
        </div>
      )}
    </div>
  ) : null;

  // ── SECTION 8: Terms & Conditions ─────────────────────────────────────────
  const TermsSection = settings.showTermsConditions ? (
    <div
      style={{
        ...sec,
        padding: '8px 16px',
      }}
    >
      <T id="terms_label" style={{ color: theme.primaryColor, marginBottom: '3px' }}>
        Terms &amp; Conditions
      </T>
      <T id="terms_content" as="div" style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {quotation.terms || '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.'}
      </T>
    </div>
  ) : null;

  // ── Footer strip ──────────────────────────────────────────────────────────
  const FooterStrip = (
    <div
      style={{
        ...secNoBorder,
        padding: '5px 16px',
        textAlign: 'center',
        borderTop: `1px solid ${theme.sectionBorderColor}`,
      }}
    >
      <T id="footer_strip" style={{ color: '#aaa' }}>
        Computer-generated document. No signature required.
      </T>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={outerStyle} id="document-renderer-root" onClick={() => onTypographyElementClick?.('custom_block')}>
      {settings.showWatermark && <Watermark text={company.companyName || 'DRAFT'} />}
      {theme.cornerDecorations && <CornerDecos color={theme.primaryColor} />}

      {HeaderSection}
      {/* Zone: after_header */}
      {RenderZoneBlocks('after_header')}
      <ZoneIndicator zone="after_header" />

      {MetaSection}
      {/* Zone: after_meta */}
      {RenderZoneBlocks('after_meta')}
      <ZoneIndicator zone="after_meta" />

      {PartySection}
      {/* Split zones inside party section for Bill To / Ship To areas */}
      {showZones && hasShipTo && <SplitZoneIndicators leftZone="party_left" rightZone="party_right" />}
      {/* Zone: after_party */}
      {RenderZoneBlocks('after_party')}
      <ZoneIndicator zone="after_party" />

      {ProductTable}
      {/* Zone: after_products */}
      {RenderZoneBlocks('after_products')}
      <ZoneIndicator zone="after_products" />

      {TotalsSection}
      {/* Zone: after_totals */}
      {RenderZoneBlocks('after_totals')}
      <ZoneIndicator zone="after_totals" />

      {NotesSection}
      {FooterSection}
      {/* Split zones for bank/signature area */}
      {showZones && settings.showBankDetails && settings.showSignature && (
        <SplitZoneIndicators leftZone="bank_left" rightZone="bank_right" />
      )}
      {/* Zone: after_bank */}
      {RenderZoneBlocks('after_bank')}
      <ZoneIndicator zone="after_bank" />

      {TermsSection}
      {/* Split zones for footer area */}
      {showZones && <SplitZoneIndicators leftZone="footer_left" rightZone="footer_right" />}
      {/* Zone: footer */}
      {RenderZoneBlocks('footer')}
      <ZoneIndicator zone="footer" />

      {FooterStrip}
    </div>
  );
}
