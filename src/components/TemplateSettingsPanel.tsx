import { TemplateSettings, DEFAULT_TEMPLATE_SETTINGS, TypographyElementId, DEFAULT_TYPOGRAPHY_VALUES, TypographyElementMeta } from '../types';
import { ChevronDown, ChevronRight, FileText, User, Table2, Settings2, RotateCcw, Type } from 'lucide-react';
import { useState } from 'react';

interface Props {
  settings: TemplateSettings;
  onChange: (settings: TemplateSettings) => void;
  selectedTypographyElement?: TypographyElementId;
  onTypographyElementSelect?: (elementId: TypographyElementId | undefined) => void;
}

interface SettingToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingToggle({ label, checked, onChange }: SettingToggleProps) {
  return (
    <label className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
      </div>
    </label>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function SettingsSection({ icon, title, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors"
      >
        {icon}
        <span className="text-sm font-semibold text-gray-800 flex-1 text-left">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-1 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

// Typography element display labels
const TYPOGRAPHY_ELEMENT_LABELS: Record<TypographyElementId, string> = {
  company_name: 'Company Name',
  company_address: 'Company Address',
  company_gstin: 'Company GSTIN',
  company_phone: 'Company Phone',
  company_email: 'Company Email',
  doc_title: 'Document Title (QUOTATION/TAX INVOICE)',
  original_for_recipient: 'Original For Recipient',
  quotation_number_label: 'Quotation No. Label',
  quotation_number_value: 'Quotation No. Value',
  quotation_date_label: 'Quotation Date Label',
  quotation_date_value: 'Quotation Date Value',
  invoice_number_label: 'Invoice No. Label',
  invoice_number_value: 'Invoice No. Value',
  invoice_date_label: 'Invoice Date Label',
  invoice_date_value: 'Invoice Date Value',
  due_date_label: 'Due Date Label',
  due_date_value: 'Due Date Value',
  po_number_label: 'PO Number Label',
  po_number_value: 'PO Number Value',
  eway_bill_label: 'E-Way Bill Label',
  eway_bill_value: 'E-Way Bill Value',
  vehicle_number_label: 'Vehicle Number Label',
  vehicle_number_value: 'Vehicle Number Value',
  bill_to_label: 'Bill To Label',
  bill_to_name: 'Customer Name',
  bill_to_address: 'Customer Address',
  bill_to_phone: 'Customer Phone',
  bill_to_gstin: 'Customer GSTIN',
  ship_to_label: 'Ship To Label',
  ship_to_name: 'Ship To Name',
  ship_to_address: 'Ship To Address',
  ship_to_phone: 'Ship To Phone',
  ship_to_gstin: 'Ship To GSTIN',
  table_header: 'Table Header',
  product_row: 'Product Row',
  product_description: 'Product Description',
  tax_summary_label: 'Tax Summary Label',
  tax_summary_row: 'Tax Summary Row',
  subtotal_label: 'Subtotal Label',
  subtotal_value: 'Subtotal Value',
  cgst_label: 'CGST Label',
  cgst_value: 'CGST Value',
  sgst_label: 'SGST Label',
  sgst_value: 'SGST Value',
  round_off_label: 'Round Off Label',
  round_off_value: 'Round Off Value',
  grand_total_label: 'Grand Total Label',
  grand_total_value: 'Grand Total Value',
  amount_in_words: 'Amount In Words',
  notes_label: 'Notes Label',
  notes_value: 'Notes Content',
  bank_details_label: 'Bank Details Label',
  bank_details_content: 'Bank Details Content',
  signature_label: 'Signature Label',
  terms_label: 'Terms & Conditions Label',
  terms_content: 'Terms & Conditions Content',
  footer_strip: 'Footer Strip',
  custom_block: 'Custom Block',
};

export function TemplateSettingsPanel({
  settings,
  onChange,
  selectedTypographyElement,
  onTypographyElementSelect
}: Props) {
  const updateSetting = <K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_TEMPLATE_SETTINGS);
  };

  const resetTypography = () => {
    onChange({
      ...settings,
      typographyOverrides: {},
      globalDefaultFontSize: DEFAULT_TEMPLATE_SETTINGS.globalDefaultFontSize,
    });
  };

  // Update selected element's typography
  const updateElementTypography = (
    elementId: TypographyElementId,
    property: 'fontSize' | 'fontWeight' | 'color',
    value: number | string
  ) => {
    const existing = settings.typographyOverrides?.[elementId];
    const defaults = DEFAULT_TYPOGRAPHY_VALUES[elementId];

    const newMeta: TypographyElementMeta = {
      id: elementId,
      fontSize: property === 'fontSize' ? (value as number) : (existing?.fontSize ?? defaults?.fontSize ?? 12),
      fontWeight: property === 'fontWeight' ? (value as number) : (existing?.fontWeight ?? defaults?.fontWeight ?? 400),
      color: property === 'color' ? (value as string) : (existing?.color ?? defaults?.color ?? '#000000'),
      usesGlobal: false,
    };

    onChange({
      ...settings,
      typographyOverrides: {
        ...settings.typographyOverrides,
        [elementId]: newMeta,
      },
    });
  };

  // Toggle element between using global and custom settings
  const toggleElementUsesGlobal = (elementId: TypographyElementId, usesGlobal: boolean) => {
    if (usesGlobal) {
      // Remove override to use global
      const newOverrides = { ...settings.typographyOverrides };
      delete newOverrides[elementId];
      onChange({
        ...settings,
        typographyOverrides: newOverrides,
      });
    } else {
      // Create override with current global value
      const defaults = DEFAULT_TYPOGRAPHY_VALUES[elementId];
      const newMeta: TypographyElementMeta = {
        id: elementId,
        fontSize: settings.globalDefaultFontSize ?? 12,
        fontWeight: defaults?.fontWeight ?? 400,
        color: defaults?.color ?? '#000000',
        usesGlobal: false,
      };
      onChange({
        ...settings,
        typographyOverrides: {
          ...settings.typographyOverrides,
          [elementId]: newMeta,
        },
      });
    }
  };

  // Get current typography values for selected element
  const getSelectedElementValues = () => {
    if (!selectedTypographyElement) return null;
    const override = settings.typographyOverrides?.[selectedTypographyElement];
    const defaults = DEFAULT_TYPOGRAPHY_VALUES[selectedTypographyElement];
    const hasOverride = override && override.usesGlobal === false;
    return {
      fontSize: hasOverride ? override.fontSize : (settings.globalDefaultFontSize ?? 12),
      fontWeight: hasOverride ? override.fontWeight : (defaults?.fontWeight ?? 400),
      color: hasOverride ? override.color : (defaults?.color ?? '#000000'),
      usesGlobal: !hasOverride,
    };
  };

  const selectedElementValues = getSelectedElementValues();

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Template Settings</h3>
        </div>
        <button
          onClick={resetToDefaults}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
        >
          Reset All
        </button>
      </div>

      {/* Settings sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Header Layout */}
        <SettingsSection
          icon={<Settings2 className="w-4 h-4 text-blue-600" />}
          title="Header Layout"
        >
          <div className="py-2 px-3">
            <label className="block text-sm text-slate-700 mb-1.5">Header Position</label>
            <select
              value={settings.headerAlignment}
              onChange={(e) => updateSetting('headerAlignment', e.target.value as 'left' | 'center' | 'right')}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Controls company header alignment in preview, PDF &amp; print.
            </p>
          </div>
        </SettingsSection>

        {/* Invoice Details */}
        <SettingsSection
          icon={<FileText className="w-4 h-4 text-blue-600" />}
          title="Invoice Details"
        >
          <SettingToggle
            label="PO Number"
            checked={settings.showPoNumber}
            onChange={(v) => updateSetting('showPoNumber', v)}
          />
          <SettingToggle
            label="Vehicle Number"
            checked={settings.showVehicleNumber}
            onChange={(v) => updateSetting('showVehicleNumber', v)}
          />
          <SettingToggle
            label="E-Way Bill"
            checked={settings.showEwayBill}
            onChange={(v) => updateSetting('showEwayBill', v)}
          />
          <SettingToggle
            label="Due Date"
            checked={settings.showDueDate}
            onChange={(v) => updateSetting('showDueDate', v)}
          />
        </SettingsSection>

        {/* Party Details */}
        <SettingsSection
          icon={<User className="w-4 h-4 text-green-600" />}
          title="Party Details"
        >
          <SettingToggle
            label="Phone"
            checked={settings.showPhone}
            onChange={(v) => updateSetting('showPhone', v)}
          />
          <SettingToggle
            label="GSTIN"
            checked={settings.showGstin}
            onChange={(v) => updateSetting('showGstin', v)}
          />
          <SettingToggle
            label="Billing Address"
            checked={settings.showBillingAddress}
            onChange={(v) => updateSetting('showBillingAddress', v)}
          />
          <SettingToggle
            label="Shipping Address"
            checked={settings.showShippingAddress}
            onChange={(v) => updateSetting('showShippingAddress', v)}
          />
        </SettingsSection>

        {/* Item Table Columns */}
        <SettingsSection
          icon={<Table2 className="w-4 h-4 text-amber-600" />}
          title="Item Table Columns"
        >
          <SettingToggle
            label="Description"
            checked={settings.showDescription}
            onChange={(v) => updateSetting('showDescription', v)}
          />
          <SettingToggle
            label="Quantity"
            checked={settings.showQuantity}
            onChange={(v) => updateSetting('showQuantity', v)}
          />
          <SettingToggle
            label="Unit"
            checked={settings.showUnit}
            onChange={(v) => updateSetting('showUnit', v)}
          />
          <SettingToggle
            label="Discount"
            checked={settings.showDiscount}
            onChange={(v) => updateSetting('showDiscount', v)}
          />
          <SettingToggle
            label="Tax"
            checked={settings.showTax}
            onChange={(v) => updateSetting('showTax', v)}
          />
          <SettingToggle
            label="Batch Number"
            checked={settings.showBatchNumber}
            onChange={(v) => updateSetting('showBatchNumber', v)}
          />
          <SettingToggle
            label="Expiry Date"
            checked={settings.showExpiryDate}
            onChange={(v) => updateSetting('showExpiryDate', v)}
          />
        </SettingsSection>

        {/* Typography */}
        <SettingsSection
          icon={<Type className="w-4 h-4 text-purple-600" />}
          title="Typography"
        >
          <div className="py-2 px-3 space-y-4">
            {/* Global Default Font Size */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Global Font Size (All Text)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={settings.globalDefaultFontSize ?? 12}
                  onChange={(e) => updateSetting('globalDefaultFontSize', Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <input
                  type="number"
                  min={6}
                  max={72}
                  value={settings.globalDefaultFontSize ?? 12}
                  onChange={(e) => updateSetting('globalDefaultFontSize', Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-slate-300 rounded-md text-sm text-center"
                />
                <span className="text-xs text-gray-500">px</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This size applies to ALL text. Use individual controls for specific elements.
              </p>
            </div>

            {/* Reset Typography Button */}
            <button
              onClick={resetTypography}
              className="w-full px-3 py-2 flex items-center justify-center gap-2 bg-slate-100 hover:bg-gray-200 rounded-md text-sm text-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All Typography
            </button>

            {/* Selected Element Typography Controls */}
            {selectedTypographyElement && selectedElementValues && (
              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {TYPOGRAPHY_ELEMENT_LABELS[selectedTypographyElement] || selectedTypographyElement}
                  </h4>
                  <button
                    onClick={() => onTypographyElementSelect?.(undefined)}
                    className="text-xs text-gray-500 hover:text-slate-700"
                  >
                    Clear Selection
                  </button>
                </div>

                {/* Global Override Toggle */}
                <label className="flex items-center gap-2 mb-3 p-2 bg-white rounded border">
                  <input
                    type="checkbox"
                    checked={selectedElementValues.usesGlobal}
                    onChange={(e) => toggleElementUsesGlobal(selectedTypographyElement, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-xs text-gray-600">Use global font size ({settings.globalDefaultFontSize ?? 12}px)</span>
                </label>

                {/* Per-element controls (only when not using global) */}
                {!selectedElementValues.usesGlobal && (
                  <>
                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 mb-1">Custom Font Size</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={6}
                          max={72}
                          value={selectedElementValues.fontSize}
                          onChange={(e) => updateElementTypography(selectedTypographyElement, 'fontSize', Number(e.target.value))}
                          className="flex-1 accent-purple-600"
                        />
                        <input
                          type="number"
                          min={6}
                          max={72}
                          value={selectedElementValues.fontSize}
                          onChange={(e) => updateElementTypography(selectedTypographyElement, 'fontSize', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 border border-slate-300 rounded-md text-xs text-center"
                        />
                        <span className="text-xs text-gray-500">px</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 mb-1">Font Weight</label>
                      <select
                        value={selectedElementValues.fontWeight}
                        onChange={(e) => updateElementTypography(selectedTypographyElement, 'fontWeight', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-slate-300 rounded-md text-sm"
                      >
                        <option value={300}>Light (300)</option>
                        <option value={400}>Normal (400)</option>
                        <option value={500}>Medium (500)</option>
                        <option value={600}>Semi Bold (600)</option>
                        <option value={700}>Bold (700)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Font Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedElementValues.color}
                          onChange={(e) => updateElementTypography(selectedTypographyElement, 'color', e.target.value)}
                          className="w-8 h-8 border border-slate-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedElementValues.color}
                          onChange={(e) => updateElementTypography(selectedTypographyElement, 'color', e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded-md text-sm font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Instructions when nothing selected */}
            {!selectedTypographyElement && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <p className="text-xs text-gray-600 mb-2">
                  Click any text in the preview to customize it individually.
                </p>
                <p className="text-xs text-gray-400">
                  Selected text will show custom controls above.
                </p>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Totals */}
        <SettingsSection
          icon={<Table2 className="w-4 h-4 text-emerald-600" />}
          title="Totals"
        >
          <SettingToggle
            label="Show Tax Summary Table"
            checked={settings.showTaxSummary}
            onChange={(v) => updateSetting('showTaxSummary', v)}
          />
        </SettingsSection>

        {/* Miscellaneous */}
        <SettingsSection
          icon={<Settings2 className="w-4 h-4 text-gray-600" />}
          title="Miscellaneous"
          defaultOpen={false}
        >
          <SettingToggle
            label="Bank Details"
            checked={settings.showBankDetails}
            onChange={(v) => updateSetting('showBankDetails', v)}
          />
          <SettingToggle
            label="Payment QR Code"
            checked={settings.showPaymentQr}
            onChange={(v) => updateSetting('showPaymentQr', v)}
          />
          <SettingToggle
            label="Signature"
            checked={settings.showSignature}
            onChange={(v) => updateSetting('showSignature', v)}
          />
          <SettingToggle
            label="Notes"
            checked={settings.showNotes}
            onChange={(v) => updateSetting('showNotes', v)}
          />
          <SettingToggle
            label="Terms & Conditions"
            checked={settings.showTermsConditions}
            onChange={(v) => updateSetting('showTermsConditions', v)}
          />
          <SettingToggle
            label="Watermark"
            checked={settings.showWatermark}
            onChange={(v) => updateSetting('showWatermark', v)}
          />
        </SettingsSection>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-gray-500">
          Click text in preview for element-level typography control.
        </p>
      </div>
    </div>
  );
}
