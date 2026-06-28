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
 */

import React from 'react';
import {
  CompanyProfile, Customer, Quotation, Product,
  TemplateSettings, Invoice, InvoiceTheme, INVOICE_THEMES, ThemeId,
  TemplateBlock, BlockZone,
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
}: Props) {
  const theme: InvoiceTheme = INVOICE_THEMES[themeId] ?? INVOICE_THEMES.simple;
  const gstMode = quotation.gstMode ?? 'inclusive';

  // Typography colors (user-customizable via Template Settings → Typography)
  const headerTextColor = settings.headerTextColor ?? '#000000';
  const bodyTextColor = settings.bodyTextColor ?? '#000000';
  const tableHeaderTextColor = settings.tableHeaderTextColor ?? '#000000';
  const totalSectionColor = settings.totalSectionColor ?? '#000000';

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
    fontSize: '11px',
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
              <div style={{ fontSize: '10px', fontWeight: 700, color: theme.primaryColor, marginBottom: '4px' }}>
                Bank Details
              </div>
              {company.bankName && <div style={{ fontSize: '10.5px' }}>Bank: <strong>{company.bankName}</strong></div>}
              {company.bankAccount && <div style={{ fontSize: '10.5px' }}>A/c: <strong>{company.bankAccount}</strong></div>}
              {company.bankIfsc && <div style={{ fontSize: '10.5px' }}>IFSC: <strong>{company.bankIfsc}</strong></div>}
              {company.bankBranch && <div style={{ fontSize: '10.5px' }}>Branch: {company.bankBranch}</div>}
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
              <div style={{ borderTop: `1px solid ${theme.sectionBorderColor}`, paddingTop: '4px', fontSize: '9px', color: bodyTextColor }}>
                Authorised Signatory
              </div>
            </div>
          );

        case 'terms_conditions':
          return (
            <>
              <div style={{ fontWeight: 700, color: theme.primaryColor, marginBottom: '3px', fontSize: '10px' }}>
                Terms &amp; Conditions
              </div>
              <div style={{ color: bodyTextColor, lineHeight: 1.5, fontSize: '10px', whiteSpace: 'pre-wrap' }}>
                {block.content || '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.'}
              </div>
            </>
          );

        case 'footer_notes':
          return (
            <div style={{ fontSize: '10px', textAlign: 'center', color: bodyTextColor, whiteSpace: 'pre-wrap' }}>
              {block.content || 'Thank you for your business!'}
            </div>
          );

        case 'warranty':
          return (
            <>
              <div style={{ fontWeight: 700, color: theme.primaryColor, marginBottom: '3px', fontSize: '10px' }}>
                Warranty
              </div>
              <div style={{ color: bodyTextColor, lineHeight: 1.5, fontSize: '10px', whiteSpace: 'pre-wrap' }}>
                {block.content || 'Product warranty: 12 months from date of purchase.\nWarranty covers manufacturing defects only.'}
              </div>
            </>
          );

        case 'transport_details':
          return (
            <>
              <div style={{ fontWeight: 700, color: theme.primaryColor, marginBottom: '3px', fontSize: '10px' }}>
                Transport Details
              </div>
              <div style={{ color: bodyTextColor, lineHeight: 1.5, fontSize: '10px' }}>
                {block.content || 'Transport: To be arranged by buyer'}
              </div>
            </>
          );

        case 'delivery_details':
          return (
            <>
              <div style={{ fontWeight: 700, color: theme.primaryColor, marginBottom: '3px', fontSize: '10px' }}>
                Delivery Details
              </div>
              <div style={{ color: bodyTextColor, lineHeight: 1.5, fontSize: '10px' }}>
                {block.content || 'Delivery: Within 7-10 working days\nDelivery charges extra as applicable'}
              </div>
            </>
          );

        case 'installation_details':
          return (
            <>
              <div style={{ fontWeight: 700, color: theme.primaryColor, marginBottom: '3px', fontSize: '10px' }}>
                Installation Details
              </div>
              <div style={{ color: '#555', lineHeight: 1.5, fontSize: '10px' }}>
                {block.content || 'Installation: To be done by our certified technician\nInstallation charges included in the quote'}
              </div>
            </>
          );

        case 'divider':
          return (
            <div style={{ width: '100%', height: '1px', backgroundColor: block.style?.color || theme.sectionBorderColor, margin: '4px 0' }} />
          );

        case 'text_block':
        default:
          return (
            <div style={{ fontSize: '10px', color: bodyTextColor, whiteSpace: 'pre-wrap' }}>
              {block.content || 'Custom content'}
            </div>
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
        <div
          style={{
            fontSize: `${theme.companyNameSize}px`,
            fontWeight: 700,
            color: headerTextColor,
            lineHeight: 1.15,
            letterSpacing: '-0.2px',
          }}
        >
          {company.companyName || 'Company Name'}
        </div>
        {company.address && (
          <div style={{ fontSize: '10px', marginTop: '3px' }}>{company.address}</div>
        )}
        {settings.showGstin && company.gstNumber && (
          <div style={{ fontSize: '10px', marginTop: '3px' }}>
            GSTIN&nbsp;
            <strong style={{ letterSpacing: '0.3px' }}>{company.gstNumber}</strong>
          </div>
        )}
        {settings.showPhone && company.phone && (
          <div style={{ fontSize: '10px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
            <span>📞</span> {company.phone}
            {company.email && (
              <><span style={{ margin: '0 4px' }}>✉</span>{company.email}</>
            )}
          </div>
        )}
        {!settings.showPhone && company.email && (
          <div style={{ fontSize: '10px', marginTop: '2px' }}>✉ {company.email}</div>
        )}
      </div>
    </div>
  );

  const DocTypeBlock = (
    <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
      <div
        style={{
          fontSize: `${theme.docTypeFontSize}px`,
          fontWeight: 800,
          color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
          letterSpacing: '1px',
        }}
      >
        {docLabel}
      </div>
      <div
        style={{
          fontSize: '7.5px',
          border: `1px solid ${themeId === 'stylish' ? '#FFFFFF99' : theme.primaryColor}`,
          padding: '1px 7px',
          marginTop: '3px',
          color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
          letterSpacing: '0.5px',
          display: 'inline-block',
        }}
      >
        ORIGINAL FOR RECIPIENT
      </div>
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
            <div
              style={{
                fontSize: `${theme.docTypeFontSize}px`,
                fontWeight: 800,
                color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
                letterSpacing: '1px',
                marginBottom: '6px',
              }}
            >
              {docLabel}
            </div>
            <CompanyInfoBlock align="center" />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                fontSize: '7.5px',
                border: `1px solid ${themeId === 'stylish' ? '#FFFFFF99' : theme.primaryColor}`,
                padding: '1px 7px',
                color: themeId === 'stylish' ? '#FFFFFF' : theme.primaryColor,
                letterSpacing: '0.5px',
                display: 'inline-block',
              }}
            >
              ORIGINAL FOR RECIPIENT
            </div>
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
      <MetaCell label={docType === 'invoice' ? 'Invoice No.' : 'Quotation No.'} value={docNumber} theme={theme} />
      <MetaCell label={docType === 'invoice' ? 'Invoice Date' : 'Quotation Date'} value={docDate} theme={theme} />
      {settings.showDueDate && dueDate && (
        <MetaCell label="Due Date" value={dueDate} theme={theme} highlight />
      )}
      {settings.showDueDate && !dueDate && (
        <MetaCell label="Due Date" value="—" theme={theme} />
      )}
      {settings.showPoNumber && (
        <MetaCell label="PO Number" value="—" theme={theme} />
      )}
      {settings.showEwayBill && (
        <MetaCell label="E-Way Bill" value="—" theme={theme} />
      )}
      {settings.showVehicleNumber && (
        <MetaCell label="Vehicle No." value="—" theme={theme} />
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
        <div style={{ fontSize: '10px', fontWeight: 700, color: theme.primaryColor, marginBottom: '4px' }}>
          Bill To
        </div>
        <div style={{ fontWeight: 700, fontSize: '12px' }}>{customer.name}</div>
        {settings.showBillingAddress && customer.billingAddress && (
          <div style={{ color: bodyTextColor, marginTop: '2px', fontSize: '10.5px' }}>
            {customer.billingAddress}
          </div>
        )}
        {(customer.village || customer.district) && (
          <div style={{ color: bodyTextColor, fontSize: '10.5px' }}>
            {[customer.village, customer.district].filter(Boolean).join(', ')}
          </div>
        )}
        {settings.showPhone && customer.mobile && (
          <div style={{ marginTop: '2px', fontSize: '10.5px' }}>
            Mobile <strong>{customer.mobile}</strong>
          </div>
        )}
        {settings.showGstin && customer.gstNumber && (
          <div style={{ fontSize: '10.5px' }}>
            GSTIN <strong>{customer.gstNumber}</strong>
          </div>
        )}
      </div>

      {/* Ship To */}
      {hasShipTo && (
        <div style={{ flex: 1, padding: '10px 16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: theme.primaryColor, marginBottom: '4px' }}>
            Ship To
          </div>
          {quotation.shipTo?.name && (
            <div style={{ fontWeight: 700, fontSize: '12px' }}>{quotation.shipTo.name}</div>
          )}
          {quotation.shipTo?.address && (
            <div style={{ color: bodyTextColor, marginTop: '2px', fontSize: '10.5px' }}>
              {quotation.shipTo.address}
            </div>
          )}
          {settings.showPhone && quotation.shipTo?.mobile && (
            <div style={{ marginTop: '2px', fontSize: '10.5px' }}>
              Mobile <strong>{quotation.shipTo.mobile}</strong>
            </div>
          )}
          {settings.showGstin && quotation.shipTo?.gstNumber && (
            <div style={{ fontSize: '10.5px' }}>
              GSTIN <strong>{quotation.shipTo.gstNumber}</strong>
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
          <Th style={{ width: '32px' }}>No</Th>
          <Th style={{ textAlign: 'left' }}>Items</Th>
          {settings.showTax && <Th style={{ width: '72px' }}>HSN No.</Th>}
          {settings.showBatchNumber && <Th style={{ width: '72px' }}>Batch No.</Th>}
          {settings.showExpiryDate && <Th style={{ width: '80px' }}>Expiry</Th>}
          {settings.showQuantity && <Th style={{ width: '54px' }}>Qty.</Th>}
          <Th style={{ width: '76px' }}>Rate</Th>
          {settings.showDiscount && <Th style={{ width: '70px' }}>Disc.</Th>}
          {settings.showTax && <Th style={{ width: '76px' }}>Tax</Th>}
          <Th style={{ width: '84px' }}>Total</Th>
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
              <Td style={{ color: bodyTextColor, textAlign: 'center' }}>{i + 1}</Td>
              <Td style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 500 }}>{product.name}</div>
                {settings.showDescription && product.description?.trim() && (
                  <div style={{ fontSize: '9.5px', color: bodyTextColor, marginTop: '2px', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                    {product.description}
                  </div>
                )}
              </Td>
              {settings.showTax && (
                <Td style={{ color: bodyTextColor }}>{product.hsnCode || '—'}</Td>
              )}
              {settings.showBatchNumber && (
                <Td style={{ color: bodyTextColor }}>{product.batchNumber || '—'}</Td>
              )}
              {settings.showExpiryDate && (
                <Td style={{ color: bodyTextColor }}>{product.expiryDate || '—'}</Td>
              )}
              {settings.showQuantity && (
                <Td style={{ color: theme.primaryColor }}>
                  {product.quantity}
                  {settings.showUnit && (
                    <span style={{ fontSize: '9px', color: bodyTextColor, marginLeft: '2px' }}>PCS</span>
                  )}
                </Td>
              )}
              <Td>{product.unitPrice.toLocaleString('en-IN')}</Td>
              {settings.showDiscount && <Td style={{ color: bodyTextColor }}>{product.discount ?? 0}</Td>}
              {settings.showTax && (
                <Td>
                  <div>{taxAmount.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '9px', color: bodyTextColor }}>({product.gstPercent}%)</div>
                </Td>
              )}
              <Td style={{ fontWeight: 600 }}>
                {amount.toLocaleString('en-IN')}
              </Td>
            </tr>
          );
        })}
        {products.length === 0 && (
          <tr>
            <td
              colSpan={8}
              style={{
                textAlign: 'center',
                padding: '20px',
                color: '#aaa',
                fontSize: '11px',
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
          <div style={{ fontSize: '10px', fontWeight: 700, color: theme.primaryColor, marginBottom: '5px' }}>
            Tax Summary
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: theme.tableHeaderBg, color: tableHeaderTextColor }}>
                {['HSN', 'Tax%', 'Taxable Amt', 'CGST', 'SGST'].map(h => (
                  <th key={h} style={{ padding: '3px 5px', textAlign: h === 'HSN' ? 'left' : 'right', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(taxSummary.entries()).map(([key, data]) => {
                const [hsn, rate] = key.split('_');
                return (
                  <tr key={key} style={{ borderTop: `1px solid ${theme.tableBorderColor}` }}>
                    <td style={{ padding: '2px 5px' }}>{hsn}</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}>{rate}%</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}>{fmt(data.taxableAmount)}</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}>{fmt(data.cgstAmount)}</td>
                    <td style={{ padding: '2px 5px', textAlign: 'right' }}>{fmt(data.sgstAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grand Total */}
      <div style={{ width: showTaxSummary ? '220px' : '100%', padding: '10px 16px', flexShrink: 0 }}>
        <TotalRow label="Sub Total" value={`₹${fmt(totalTaxable)}`} color={totalSectionColor} />
        <TotalRow label="CGST" value={`₹${fmt(totalCgst)}`} color={totalSectionColor} />
        <TotalRow label="SGST" value={`₹${fmt(totalSgst)}`} color={totalSectionColor} />
        {roundOff !== 0 && (
          <TotalRow label="Round Off" value={`₹${fmt(roundOff)}`} color={totalSectionColor} />
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: `1.5px solid ${theme.sectionBorderColor}`,
            paddingTop: '5px',
            marginTop: '5px',
            fontSize: '13px',
            fontWeight: 700,
            color: totalSectionColor,
          }}
        >
          <span>Total</span>
          <span style={{ color: totalSectionColor }}>₹{fmt(roundedGrandTotal)}</span>
        </div>
        <div style={{ fontSize: '9px', color: totalSectionColor, marginTop: '4px', fontStyle: 'italic', lineHeight: 1.4 }}>
          {numberToWords(roundedGrandTotal)}
        </div>
      </div>
    </div>
  );

  // ── SECTION 6: Notes ──────────────────────────────────────────────────────
  const NotesSection = settings.showNotes ? (
    <div style={{ ...sec, padding: '8px 16px', fontSize: '10.5px' }}>
      <span style={{ fontWeight: 700, color: theme.primaryColor }}>Notes: </span>
      <span style={{ color: bodyTextColor }}>{quotation.notes || 'Thank you for your business!'}</span>
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
          <div style={{ fontSize: '10px', fontWeight: 700, color: theme.primaryColor, marginBottom: '4px' }}>
            Bank Details
          </div>
          {company.bankName && (
            <div style={{ fontSize: '10.5px' }}>
              Bank: <strong>{company.bankName}</strong>
            </div>
          )}
          {company.bankAccount && (
            <div style={{ fontSize: '10.5px' }}>
              A/c: <strong>{company.bankAccount}</strong>
            </div>
          )}
          {company.bankIfsc && (
            <div style={{ fontSize: '10.5px' }}>
              IFSC: <strong>{company.bankIfsc}</strong>
            </div>
          )}
          {company.bankBranch && (
            <div style={{ fontSize: '10.5px' }}>
              Branch: {company.bankBranch}
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
                fontSize: '9px',
                color: bodyTextColor,
                borderRadius: '2px',
              }}
            >
              QR Code
            </div>
          )}
          <div style={{ fontSize: '8.5px', color: bodyTextColor, marginTop: '3px' }}>Scan to Pay</div>
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
              fontSize: '9px',
              color: bodyTextColor,
            }}
          >
            Authorised Signatory
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
        fontSize: '10px',
      }}
    >
      <div style={{ fontWeight: 700, color: theme.primaryColor, marginBottom: '3px' }}>
        Terms &amp; Conditions
      </div>
      <div style={{ color: bodyTextColor, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {quotation.terms || '1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.\n3. Payment due within 30 days of the invoice/quotation date.'}
      </div>
    </div>
  ) : null;

  // ── Footer strip ──────────────────────────────────────────────────────────
  const FooterStrip = (
    <div
      style={{
        ...secNoBorder,
        padding: '5px 16px',
        textAlign: 'center',
        fontSize: '8.5px',
        color: '#aaa',
        borderTop: `1px solid ${theme.sectionBorderColor}`,
      }}
    >
      Computer-generated document. No signature required.
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={outerStyle} id="document-renderer-root">
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

// ─── Small helper sub-components ─────────────────────────────────────────────
function MetaCell({
  label,
  value,
  theme,
  highlight = false,
}: {
  label: string;
  value: string;
  theme: InvoiceTheme;
  highlight?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: '8.5px', color: '#111111', marginBottom: '2px' }}>{label}</div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '11px',
          color: highlight ? theme.primaryColor : 'inherit',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TotalRow({ label, value, color = '#000000' }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '3px',
        fontSize: '11px',
        fontWeight: 500,
      }}
    >
      <span style={{ color, fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Th({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: '6px 8px',
        textAlign: 'right',
        fontWeight: 700,
        fontSize: '10.5px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '6px 8px',
        textAlign: 'right',
        fontSize: '10.5px',
        verticalAlign: 'top',
        ...style,
      }}
    >
      {children}
    </td>
  );
}
