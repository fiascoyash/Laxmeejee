import { TemplateSettings, DEFAULT_TEMPLATE_SETTINGS } from '../types';
import { ChevronDown, ChevronRight, FileText, User, Table2, Settings2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  settings: TemplateSettings;
  onChange: (settings: TemplateSettings) => void;
}

interface SettingToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function SettingToggle({ label, checked, onChange }: SettingToggleProps) {
  return (
    <label className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
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
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors"
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

export function TemplateSettingsPanel({ settings, onChange }: Props) {
  const updateSetting = <K extends keyof TemplateSettings>(key: K, value: TemplateSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_TEMPLATE_SETTINGS);
  };

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">Template Settings</h3>
        </div>
        <button
          onClick={resetToDefaults}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
        >
          Reset
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
            <label className="block text-sm text-gray-700 mb-1.5">Header Position</label>
            <select
              value={settings.headerAlignment}
              onChange={(e) => updateSetting('headerAlignment', e.target.value as 'left' | 'center' | 'right')}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
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
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500">
          Settings control the visibility of different elements in the template preview.
        </p>
      </div>
    </div>
  );
}
